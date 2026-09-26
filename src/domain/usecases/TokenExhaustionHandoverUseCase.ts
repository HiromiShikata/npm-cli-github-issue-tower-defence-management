import { ClaudeHandoverSession } from '../entities/ClaudeHandoverSession';
import {
  TokenExhaustionHandoverState,
  TokenExhaustionHandoverStateEntry,
} from '../entities/TokenExhaustionHandoverState';
import { ClaudeHandoverSessionRepository } from './adapter-interfaces/ClaudeHandoverSessionRepository';
import { IssueCheckpointRepository } from './adapter-interfaces/IssueCheckpointRepository';
import { ProcessSignalRepository } from './adapter-interfaces/ProcessSignalRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import {
  TokenModelWeeklyLimit,
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from './adapter-interfaces/TokenRateLimitSnapshotRepository';

export const TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = 900;
export const TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS = 3600;
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
  state: TokenExhaustionHandoverState;
  now: Date;
};

export type TokenExhaustionHandoverResult = {
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
    private readonly issueCheckpointRepository: Pick<
      IssueCheckpointRepository,
      'postCheckpoint'
    >,
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

    const nextEntries: Record<string, TokenExhaustionHandoverStateEntry> = {
      ...input.state.entries,
    };
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
        const verdict = this.evaluateSnapshot(snapshot, nowEpochSeconds);
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

        if (!input.enabled) {
          console.log(
            `Token exhaustion handover: would kill${this.needsRelaunch(session) ? ' and relaunch' : ''} ${this.displayName(session)} kind=${session.kind} reason=${verdict.reason} (dry-run, enabled=false)`,
          );
          delete nextEntries[stateKey];
          continue;
        }
        await this.forceKill(session, {
          signaledAtEpoch: nowEpochSeconds,
          pid: session.pid,
        });
        if (this.needsRelaunch(session)) {
          await this.relaunchBareNameLeader(session, relaunchedLeaderNames);
        }
        if (hasTmux) {
          killedSessionNames.push(this.displayName(session));
        } else {
          terminatedPids.push(session.pid);
        }
        console.log(
          `Token exhaustion handover: killed${this.needsRelaunch(session) ? ' and relaunched' : ''} ${this.displayName(session)} kind=${session.kind} reason=${verdict.reason} enabled=${input.enabled}`,
        );
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
      `Token exhaustion handover: cycle summary evaluated=${sessions.length} enabled=${input.enabled} killed=${killedSessionNames.length} terminatedPids=${terminatedPids.length} relaunched=${relaunchedLeaderNames.length} leftAlive=${leftAliveSessionNames.length} skippedWorkspacePreparation=${skippedWorkspacePreparationSessionNames.length}`,
    );

    return {
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

  private forceKill = async (
    session: ClaudeHandoverSession,
    entry: TokenExhaustionHandoverStateEntry,
  ): Promise<void> => {
    if (session.kind === 'implSubagent') {
      this.processSignalRepository.terminateProcess(entry.pid);
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
      const verdict = this.evaluateSnapshot(snapshot, nowEpochSeconds);
      if (!verdict.stale && !verdict.exhausted) {
        return true;
      }
    }
    return false;
  };

  private evaluateSnapshot = (
    snapshot: TokenRateLimitSnapshot,
    nowEpochSeconds: number,
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

    const exhausted = blocked || weeklyCapped;
    const reason = weeklyCapped
      ? 'weekly_hard_cap_rejected'
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
