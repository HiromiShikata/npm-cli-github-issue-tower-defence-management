import { ClaudeInteractiveSessionRepository } from './adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import {
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from './adapter-interfaces/TokenRateLimitSnapshotRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE =
  'Token rate limit exhausted. Sending handover — this session will be restarted with a fresh token.';
export const DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS = 180;
export const TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = 900;

export type TokenExhaustionHandoverInput = {
  enabled: boolean;
  handoverMessage: string;
  gracePeriodSeconds: number;
  handoverSentAtEpochBySessionName: ReadonlyMap<string, number>;
  now: Date;
};

export type TokenExhaustionHandoverResult = {
  newlyHandoverSentSessionNames: string[];
  killedSessionNames: string[];
};

export class TokenExhaustionHandoverUseCase {
  constructor(
    private readonly interactiveSessionRepository: Pick<
      ClaudeInteractiveSessionRepository,
      'listInteractiveSessions'
    >,
    private readonly snapshotRepository: Pick<
      TokenRateLimitSnapshotRepository,
      'listSnapshots'
    >,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'sendKeys' | 'killSession'
    >,
  ) {}

  run = async (
    input: TokenExhaustionHandoverInput,
  ): Promise<TokenExhaustionHandoverResult> => {
    const nowEpochSeconds = Math.floor(input.now.getTime() / 1000);
    const interactiveSessions =
      this.interactiveSessionRepository.listInteractiveSessions();
    const snapshots = this.snapshotRepository.listSnapshots();

    const exhaustedTokens = new Set(
      snapshots
        .filter((s) =>
          this.isSnapshotFresh(s.lastUpdatedEpoch, nowEpochSeconds),
        )
        .filter((s) => this.isExhausted(s, nowEpochSeconds))
        .map((s) => s.token),
    );

    const newlyHandoverSentSessionNames: string[] = [];
    const killedSessionNames: string[] = [];

    for (const session of interactiveSessions) {
      if (!exhaustedTokens.has(session.token)) {
        continue;
      }
      const sessionName = toTmuxSessionName(session.issueUrl);
      const handoverSentAt =
        input.handoverSentAtEpochBySessionName.get(sessionName);

      if (handoverSentAt === undefined) {
        if (input.enabled) {
          await this.tmuxSessionRepository.sendKeys(
            sessionName,
            input.handoverMessage,
          );
        }
        console.log(
          `Token exhaustion handover: sent to ${sessionName} at=${input.now.toISOString()} enabled=${input.enabled}`,
        );
        newlyHandoverSentSessionNames.push(sessionName);
      } else if (nowEpochSeconds - handoverSentAt >= input.gracePeriodSeconds) {
        if (input.enabled) {
          await this.tmuxSessionRepository.killSession(sessionName);
        }
        console.log(
          `Token exhaustion handover: killed ${sessionName} gracePeriodElapsedSeconds=${nowEpochSeconds - handoverSentAt} enabled=${input.enabled}`,
        );
        killedSessionNames.push(sessionName);
      } else {
        console.log(
          `Token exhaustion handover: waiting for grace period for ${sessionName} remainingSeconds=${input.gracePeriodSeconds - (nowEpochSeconds - handoverSentAt)}`,
        );
      }
    }

    return { newlyHandoverSentSessionNames, killedSessionNames };
  };

  private isSnapshotFresh = (
    lastUpdatedEpoch: number,
    nowEpochSeconds: number,
  ): boolean =>
    nowEpochSeconds - lastUpdatedEpoch <
    TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS;

  private isExhausted = (
    snapshot: TokenRateLimitSnapshot,
    nowEpochSeconds: number,
  ): boolean =>
    snapshot.fiveHourUtilization >= 0.9 ||
    snapshot.sevenDayUtilization >= 0.95 ||
    snapshot.blocked ||
    snapshot.rejected ||
    snapshot.blockedUntilEpoch > nowEpochSeconds;
}
