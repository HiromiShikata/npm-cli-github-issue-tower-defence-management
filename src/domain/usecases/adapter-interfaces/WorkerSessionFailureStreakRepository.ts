import { WorkerSessionFailureStreak } from '../../entities/WorkerSessionFailureStreak';

export interface WorkerSessionFailureStreakRepository {
  findByIssueUrl: (
    issueUrl: string,
  ) => Promise<WorkerSessionFailureStreak | null>;
  save: (issueUrl: string, streak: WorkerSessionFailureStreak) => Promise<void>;
  deleteByIssueUrl: (issueUrl: string) => Promise<void>;
}
