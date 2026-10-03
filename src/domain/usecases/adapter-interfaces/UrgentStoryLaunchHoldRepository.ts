import type { ClaudeTokenUsage } from '../../entities/ClaudeTokenUsage';
import type { UrgentStoryLaunchHoldBoardState } from '../urgentStoryLaunchHoldDecide';

export interface UrgentStoryLaunchHoldRepository {
  readBoardState(now: Date): Promise<UrgentStoryLaunchHoldBoardState>;
  getAvailableTokenUsages(): Promise<ClaudeTokenUsage[]>;
  getTokenInFlightCounts(): Promise<Record<string, number>>;
  getPendingTokenLaunchReservationCounts(
    tokens: string[],
  ): Promise<Record<string, number>>;
  createHoldingRecord(projectUrl: string | null): Promise<void>;
  deleteHoldingRecord(): Promise<void>;
  recordTimedOutIssueUrls(issueUrls: string[], recordedAt: Date): Promise<void>;
}
