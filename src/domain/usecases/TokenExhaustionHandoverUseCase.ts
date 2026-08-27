import { ClaudeHandoverSession } from '../entities/ClaudeHandoverSession';
import {
  TokenExhaustionHandoverState,
  TokenExhaustionHandoverStateEntry,
} from '../entities/TokenExhaustionHandoverState';
import { ClaudeHandoverSessionRepository } from './adapter-interfaces/ClaudeHandoverSessionRepository';
import { ProcessSignalRepository } from './adapter-interfaces/ProcessSignalRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import {
  TokenModelWeeklyLimit,
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from './adapter-interfaces/TokenRateLimitSnapshotRepository';

export const DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE =
  'TOKEN NEAR EXHAUSTION. Within 2 minutes, write a CHECKPOINT to your assigned task issue: the in-flight subagents and what each is doing, their durable refs (branch and pull request URLs), the working directory and branch, the single concrete next action to resume, and the reason (token near exhaustion). Do this WITHOUT waiting for long-running or CI-watching subagents. Then self-kill your own tmux session with `tmux kill-session`.';

export const DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER =
  'TOKEN NEAR EXHAUSTION. You are a resident leader with no assigned task issue. Within 2 minutes, write a CHECKPOINT for every in-flight subagent (what each is doing and its durable refs = branch and pull request URLs, plus the single concrete next action to resume and the working directory and branch) into the GitHub issue that each subagent is working on, WITHOUT waiting for long-running or CI-watching subagents. Then stop and stay idle; do NOT self-kill. This session will be terminated and relaunched on a token that still has quota so its work is preserved.';

export const DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS = 180;
export const TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = 900;
export const TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS = 3600;
export const TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD = 0.1;
export const TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD = 0.05;
export const TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD = 0.25;
export const TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD = 0.15;

type SnapshotVerdict = {
  stale: boolean;
  exhausted: boolean;
  reason: string;
  fiveHourFree: number;
  sevenDayFree: number;
  blocked: boolean;
  weeklyCapped: boolean;
};

export type TokenExhaustionHandoverInput = {
  enabled: boolean;
  issueUrlLeaderMessage: string;
  bareNameLeaderMessage: string;
  gracePeriodSeconds: number;
  state: TokenExhaustionHandoverState;
  now: Date;
};

export type TokenExhaustionHandoverResult = {
  newlyHandoverSentSessionNames: string[];
  killedSessionNames: string[];
  terminatedPids: number[];
  relaunchedLeaderNames: string[];
  leftAliveSessionNames: string[];
  skippedWorkspacePreparationSessionNames: string[];
  state: TokenExhaustionHandoverState;
};

export class TokenExhaustionHandoverUseCase {
  constructor(
    private readonly handoverSessionRepository: Pick<
      ClaudeHandoverSessionRepository,
      'listHandoverSessions'
    >,
    private readonly snapshotRepository: Pick<
      TokenRateLimitSnapshotRepository,
      'listSnapshots'
    >,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      | 'sendKeys'
      | 'killSession'
      | 'listLiveSessionNames'
      | 'launchBareNameLeaderSession'
    >,
    private readonly processSignalRepository: ProcessSignalRepository,
  ) {}

  run = async (
    input: TokenExhaustionHandoverInput,
  ): Promise<TokenExhaustionHandoverResult> => {
    const nowEpochSeconds = Math.floor(input.now.getTime() / 1000);
    const sessions = this.handoverSessionRepository.listHandoverSessions();
    const snapshots = this.snapshotRepository.listSnapshots();
    const snapshotByToken = new Map(
      snapshots.map((snapshot) => [snapshot.token, snapshot]),
    );
    const liveSessionNames = new Set(
      await this.tmuxSessionRepository.listLiveSessionNames(),
    );

    const nextEntries: Record<string, TokenExhaustionHandoverStateEntry> = {
      ...input.state.entries,
    };
    const newlyHandoverSentSessionNames: string[] = [];
    const killedSessionNames: string[] = [];
    const terminatedPids: number[] = [];
    const relaunchedLeaderNames: string[] = [];
    const leftAliveSessionNames: string[] = [];
    const skippedWorkspacePreparationSessionNames: string[] = [];

    for (const session of sessions) {
      try {
        if (session.runsUnderWorkspacePreparationScript) {
          console.log(
            `Token exhaustion handover: skipping ${this.displayName(session)} kind=${session.kind} (launched by the workspace preparation script, which owns its own lifecycle)`,
          );
          skippedWorkspacePreparationSessionNames.push(
            this.displayName(session),
          );
          delete nextEntries[this.stateKeyFor(session)];
          continue;
        }
        const snapshot = snapshotByToken.get(session.token);
        if (snapshot === undefined) {
          continue;
        }
        const hasTmux = session.kind !== 'implSubagent';
        const verdict = this.evaluateSnapshot(
          snapshot,
          nowEpochSeconds,
          hasTmux,
        );
        const stateKey = this.stateKeyFor(session);

        if (verdict.stale) {
          continue;
        }
        if (!verdict.exhausted) {
          delete nextEntries[stateKey];
          continue;
        }
        if (
          !this.isFresherTokenAvailable(
            session.token,
            snapshots,
            nowEpochSeconds,
          )
        ) {
          console.log(
            `Token exhaustion handover: leaving ${this.displayName(session)} alive (token pool globally exhausted, no fresher token available)`,
          );
          leftAliveSessionNames.push(this.displayName(session));
          continue;
        }

        const entry = nextEntries[stateKey];
        if (entry === undefined) {
          if (input.enabled) {
            await this.sendHandover(session, input);
          }
          console.log(
            `Token exhaustion handover: signaled ${this.displayName(session)} kind=${session.kind} reason=${verdict.reason} enabled=${input.enabled}`,
          );
          nextEntries[stateKey] = {
            signaledAtEpoch: nowEpochSeconds,
            pid: session.pid,
          };
          newlyHandoverSentSessionNames.push(this.displayName(session));
          continue;
        }

        if (
          nowEpochSeconds - entry.signaledAtEpoch <
          input.gracePeriodSeconds
        ) {
          console.log(
            `Token exhaustion handover: waiting for grace period for ${this.displayName(session)} remainingSeconds=${input.gracePeriodSeconds - (nowEpochSeconds - entry.signaledAtEpoch)}`,
          );
          continue;
        }

        const alive = hasTmux
          ? session.sessionName !== null &&
            liveSessionNames.has(session.sessionName)
          : this.processSignalRepository.isProcessAlive(entry.pid);
        if (!alive) {
          if (input.enabled && this.needsRelaunch(session)) {
            await this.relaunchBareNameLeader(session, relaunchedLeaderNames);
          }
          delete nextEntries[stateKey];
          continue;
        }

        if (!input.enabled) {
          console.log(
            `Token exhaustion handover: would force-kill ${this.displayName(session)} kind=${session.kind} (dry-run, enabled=false)`,
          );
          delete nextEntries[stateKey];
          continue;
        }

        await this.forceKill(session, entry);
        if (this.needsRelaunch(session)) {
          await this.relaunchBareNameLeader(session, relaunchedLeaderNames);
        }
        console.log(
          `Token exhaustion handover: force-killed ${this.displayName(session)} kind=${session.kind}`,
        );
        if (hasTmux) {
          killedSessionNames.push(this.displayName(session));
        } else {
          terminatedPids.push(entry.pid);
        }
        delete nextEntries[stateKey];
      } catch (error) {
        console.error(
          `Token exhaustion handover: error processing ${this.displayName(session)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    console.log(
      `Token exhaustion handover: cycle summary evaluated=${sessions.length} enabled=${input.enabled} signaled=${newlyHandoverSentSessionNames.length} killed=${killedSessionNames.length} terminatedPids=${terminatedPids.length} relaunched=${relaunchedLeaderNames.length} leftAlive=${leftAliveSessionNames.length} skippedWorkspacePreparation=${skippedWorkspacePreparationSessionNames.length}`,
    );

    return {
      newlyHandoverSentSessionNames,
      killedSessionNames,
      terminatedPids,
      relaunchedLeaderNames,
      leftAliveSessionNames,
      skippedWorkspacePreparationSessionNames,
      state: { entries: nextEntries },
    };
  };

  private needsRelaunch = (session: ClaudeHandoverSession): boolean =>
    session.kind === 'bareNameLeader' && session.name !== null;

  private relaunchBareNameLeader = async (
    session: ClaudeHandoverSession,
    relaunchedLeaderNames: string[],
  ): Promise<void> => {
    if (session.name === null) {
      return;
    }
    await this.tmuxSessionRepository.launchBareNameLeaderSession(session.name);
    relaunchedLeaderNames.push(session.name);
  };

  private sendHandover = async (
    session: ClaudeHandoverSession,
    input: TokenExhaustionHandoverInput,
  ): Promise<void> => {
    if (session.kind === 'implSubagent') {
      this.processSignalRepository.terminateProcess(session.pid);
      return;
    }
    if (session.sessionName === null) {
      return;
    }
    const message =
      session.kind === 'issueUrlLeader'
        ? input.issueUrlLeaderMessage
        : input.bareNameLeaderMessage;
    await this.tmuxSessionRepository.sendKeys(session.sessionName, message);
  };

  private forceKill = async (
    session: ClaudeHandoverSession,
    entry: TokenExhaustionHandoverStateEntry,
  ): Promise<void> => {
    if (session.kind === 'implSubagent') {
      this.processSignalRepository.killProcess(entry.pid);
      return;
    }
    if (session.sessionName !== null) {
      try {
        await this.tmuxSessionRepository.killSession(session.sessionName);
      } catch (error) {
        console.error(
          `Token exhaustion handover: killSession failed for ${session.sessionName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    this.processSignalRepository.killProcess(entry.pid);
  };

  private stateKeyFor = (session: ClaudeHandoverSession): string =>
    session.kind === 'implSubagent'
      ? `pid:${session.pid}`
      : (session.sessionName ?? `pid:${session.pid}`);

  private displayName = (session: ClaudeHandoverSession): string =>
    session.sessionName ?? `pid:${session.pid}`;

  private isFresherTokenAvailable = (
    currentToken: string,
    snapshots: TokenRateLimitSnapshot[],
    nowEpochSeconds: number,
  ): boolean => {
    for (const snapshot of snapshots) {
      if (snapshot.token === currentToken) {
        continue;
      }
      const verdict = this.evaluateSnapshot(snapshot, nowEpochSeconds, true);
      if (!verdict.stale && !verdict.exhausted) {
        return true;
      }
    }
    return false;
  };

  private evaluateSnapshot = (
    snapshot: TokenRateLimitSnapshot,
    nowEpochSeconds: number,
    hasTmux: boolean,
  ): SnapshotVerdict => {
    const age = nowEpochSeconds - snapshot.lastUpdatedEpoch;
    const fiveHourFree = this.freeRatio(
      snapshot.fiveHourUtilization,
      snapshot.fiveHourReset,
      nowEpochSeconds,
    );
    const sevenDayFree = this.freeRatio(
      snapshot.sevenDayUtilization,
      snapshot.sevenDayReset,
      nowEpochSeconds,
    );
    const blocked =
      snapshot.blocked ||
      snapshot.rejected ||
      snapshot.blockedUntilEpoch > nowEpochSeconds;
    const weeklyCapped = this.isWeeklyCapped(
      snapshot.modelWeeklyLimits,
      nowEpochSeconds,
    );

    if (age > TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS) {
      return {
        stale: true,
        exhausted: false,
        reason: 'hard_stale',
        fiveHourFree,
        sevenDayFree,
        blocked,
        weeklyCapped,
      };
    }

    const inWarningBand =
      fiveHourFree < TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD ||
      sevenDayFree < TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD ||
      blocked ||
      weeklyCapped;
    if (
      age > TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS &&
      !inWarningBand
    ) {
      return {
        stale: true,
        exhausted: false,
        reason: 'stale_healthy',
        fiveHourFree,
        sevenDayFree,
        blocked,
        weeklyCapped,
      };
    }

    const exhausted =
      fiveHourFree < TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD ||
      (hasTmux && sevenDayFree < TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD) ||
      blocked ||
      weeklyCapped;
    const reason = weeklyCapped
      ? 'weekly_hard_cap_rejected'
      : fiveHourFree < TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD
        ? 'five_hour_free_below_threshold'
        : hasTmux && sevenDayFree < TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD
          ? 'seven_day_free_below_threshold'
          : blocked
            ? 'blocked_or_rejected'
            : 'healthy';
    return {
      stale: false,
      exhausted,
      reason,
      fiveHourFree,
      sevenDayFree,
      blocked,
      weeklyCapped,
    };
  };

  private freeRatio = (
    utilization: number,
    resetEpoch: number,
    nowEpochSeconds: number,
  ): number => {
    if (resetEpoch > 0 && nowEpochSeconds > resetEpoch) {
      return 1;
    }
    return 1 - this.clamp01(utilization);
  };

  private clamp01 = (value: number): number => {
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  };

  private isWeeklyCapped = (
    modelWeeklyLimits: TokenModelWeeklyLimit[],
    nowEpochSeconds: number,
  ): boolean => {
    for (const limit of modelWeeklyLimits) {
      if (!limit.rejected) {
        continue;
      }
      if (limit.resetsAt > 0 && nowEpochSeconds > limit.resetsAt) {
        continue;
      }
      return true;
    }
    return false;
  };
}
