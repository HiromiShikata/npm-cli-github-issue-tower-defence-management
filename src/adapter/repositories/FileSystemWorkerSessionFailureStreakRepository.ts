import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { WorkerSessionFailureStreak } from '../../domain/entities/WorkerSessionFailureStreak';
import { WorkerSessionFailureStreakRepository } from '../../domain/usecases/adapter-interfaces/WorkerSessionFailureStreakRepository';
import { tdpmCacheDirectory } from './localStorageCacheDirectory';
import { isRecord } from '../../domain/usecases/isRecord';

type StoredWorkerSessionFailureStreak = WorkerSessionFailureStreak & {
  issueUrl: string;
};

const STREAK_FILE_NAME_HASH_LENGTH = 16;

const isStoredWorkerSessionFailureStreakOf = (
  value: unknown,
  issueUrl: string,
): value is StoredWorkerSessionFailureStreak =>
  isRecord(value) &&
  value.issueUrl === issueUrl &&
  typeof value.terminalReason === 'string' &&
  value.terminalReason !== '' &&
  typeof value.consecutiveFailureCount === 'number' &&
  Number.isInteger(value.consecutiveFailureCount) &&
  value.consecutiveFailureCount >= 1;

const parsedJsonOrNullOf = (rawJson: string): unknown => {
  try {
    const parsedJson: unknown = JSON.parse(rawJson);
    return parsedJson;
  } catch {
    return null;
  }
};

export const defaultWorkerSessionFailureStreakDirectoryPath = (): string =>
  path.join(tdpmCacheDirectory(), 'worker-session-failure-streaks');

export class FileSystemWorkerSessionFailureStreakRepository implements WorkerSessionFailureStreakRepository {
  constructor(
    private readonly directoryPath: string = defaultWorkerSessionFailureStreakDirectoryPath(),
  ) {}

  findByIssueUrl = async (
    issueUrl: string,
  ): Promise<WorkerSessionFailureStreak | null> => {
    const streakFilePath = this.streakFilePathOf(issueUrl);
    if (!fs.existsSync(streakFilePath)) {
      return null;
    }
    const storedStreak = parsedJsonOrNullOf(
      fs.readFileSync(streakFilePath, 'utf8'),
    );
    if (!isStoredWorkerSessionFailureStreakOf(storedStreak, issueUrl)) {
      console.warn(
        `Ignoring the worker session failure streak file ${streakFilePath}: it does not hold {"issueUrl","terminalReason","consecutiveFailureCount"} for ${issueUrl}. It is treated as no stored streak.`,
      );
      return null;
    }
    return {
      terminalReason: storedStreak.terminalReason,
      consecutiveFailureCount: storedStreak.consecutiveFailureCount,
    };
  };

  save = async (
    issueUrl: string,
    streak: WorkerSessionFailureStreak,
  ): Promise<void> => {
    const storedStreak: StoredWorkerSessionFailureStreak = {
      issueUrl,
      terminalReason: streak.terminalReason,
      consecutiveFailureCount: streak.consecutiveFailureCount,
    };
    const streakFilePath = this.streakFilePathOf(issueUrl);
    fs.mkdirSync(this.directoryPath, { recursive: true });
    const temporaryStreakFilePath = `${streakFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryStreakFilePath, JSON.stringify(storedStreak));
    fs.renameSync(temporaryStreakFilePath, streakFilePath);
  };

  deleteByIssueUrl = async (issueUrl: string): Promise<void> => {
    fs.rmSync(this.streakFilePathOf(issueUrl), { force: true });
  };

  private streakFilePathOf = (issueUrl: string): string =>
    path.join(
      this.directoryPath,
      `${createHash('sha256').update(issueUrl).digest('hex').slice(0, STREAK_FILE_NAME_HASH_LENGTH)}.json`,
    );
}
