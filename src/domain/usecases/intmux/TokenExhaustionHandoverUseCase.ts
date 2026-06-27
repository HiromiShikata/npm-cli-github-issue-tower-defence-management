import { ClaudeInteractiveSessionRepository } from '../adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TokenRateLimitSnapshotRepository } from '../adapter-interfaces/TokenRateLimitSnapshotRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_HANDOVER_MESSAGE =
  'Your API token quota is exhausted. Please initiate the handover protocol to transfer to a fresh token.';

export const DEFAULT_GRACE_PERIOD_SECONDS = 180;

export const DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS = 900;

export const FIVE_HOUR_EXHAUSTION_THRESHOLD = 0.9;

export const SEVEN_DAY_EXHAUSTION_THRESHOLD = 0.95;

export type TokenExhaustionHandoverInput = {
  nowEpochSeconds: number;
  handoverMessageText: string;
  gracePeriodSeconds: number;
  rateLimitStaleThresholdSeconds: number;
  dryRun: boolean;
  sentHandoverTimestamps: Map<string, number>;
};

export type TokenExhaustionHandoverResult = {
  handoverInitiatedIssueUrls: string[];
  killedIssueUrls: string[];
};

export class TokenExhaustionHandoverUseCase {
  constructor(
    private readonly claudeInteractiveSessionRepository: ClaudeInteractiveSessionRepository,
    private readonly tokenRateLimitSnapshotRepository: TokenRateLimitSnapshotRepository,
    private readonly tmuxSessionRepository: TmuxSessionRepository,
  ) {}

  run = async (
    input: TokenExhaustionHandoverInput,
  ): Promise<TokenExhaustionHandoverResult> => {
    const {
      nowEpochSeconds,
      handoverMessageText,
      gracePeriodSeconds,
      rateLimitStaleThresholdSeconds,
      dryRun,
      sentHandoverTimestamps,
    } = input;

    const sessions =
      this.claudeInteractiveSessionRepository.listInteractiveSessions();

    const handoverInitiatedIssueUrls: string[] = [];
    const killedIssueUrls: string[] = [];

    for (const session of sessions) {
      const snapshot = this.tokenRateLimitSnapshotRepository.getSnapshot(
        session.token,
      );

      if (snapshot === null) {
        continue;
      }

      if (
        nowEpochSeconds - snapshot.lastUpdatedEpoch >
        rateLimitStaleThresholdSeconds
      ) {
        continue;
      }

      if (!this.isExhausted(snapshot, nowEpochSeconds)) {
        continue;
      }

      const sessionName = toTmuxSessionName(session.issueUrl);
      const previousSendTime = sentHandoverTimestamps.get(session.issueUrl);

      if (previousSendTime === undefined) {
        if (!dryRun) {
          await this.tmuxSessionRepository.sendKeys(
            sessionName,
            handoverMessageText,
          );
        }
        sentHandoverTimestamps.set(session.issueUrl, nowEpochSeconds);
        handoverInitiatedIssueUrls.push(session.issueUrl);
        continue;
      }

      const elapsedSinceHandover = nowEpochSeconds - previousSendTime;
      if (elapsedSinceHandover >= gracePeriodSeconds) {
        if (!dryRun) {
          try {
            await this.tmuxSessionRepository.killSession(sessionName);
          } catch (error) {
            console.warn(
              `Token exhaustion handover: killSession failed for "${sessionName}" (session may have already exited): ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        sentHandoverTimestamps.delete(session.issueUrl);
        killedIssueUrls.push(session.issueUrl);
      }
    }

    return { handoverInitiatedIssueUrls, killedIssueUrls };
  };

  private isExhausted = (
    snapshot: {
      fiveHourUtilization: number;
      sevenDayUtilization: number;
      blocked: boolean;
      rejected: boolean;
      blockedUntilEpoch: number;
    },
    nowEpochSeconds: number,
  ): boolean =>
    snapshot.fiveHourUtilization >= FIVE_HOUR_EXHAUSTION_THRESHOLD ||
    snapshot.sevenDayUtilization >= SEVEN_DAY_EXHAUSTION_THRESHOLD ||
    snapshot.blocked ||
    snapshot.rejected ||
    snapshot.blockedUntilEpoch > nowEpochSeconds;
}
