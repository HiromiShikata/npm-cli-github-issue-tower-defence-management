import { Sleep } from '../../repositories/issue/githubRateLimitRetry';

export const NOTIFY_FINISHED_ISSUE_PREPARATION_RETRY_DELAYS_MILLISECONDS: readonly number[] =
  [30000, 60000];

const MILLISECONDS_PER_SECOND = 1000;

export const notifyFinishedIssuePreparationRunWithRetry = async (
  notifyOnce: () => Promise<void>,
  dependencies: {
    sleep: Sleep;
    writeLine: (line: string) => void;
    writeAttemptFailure: (error: unknown) => void;
  },
): Promise<void> => {
  const attemptCount =
    NOTIFY_FINISHED_ISSUE_PREPARATION_RETRY_DELAYS_MILLISECONDS.length + 1;
  for (let attemptNumber = 1; ; attemptNumber += 1) {
    dependencies.writeLine(
      `Calling notifyFinishedIssuePreparation (attempt ${attemptNumber}/${attemptCount})...`,
    );
    const retryDelayMilliseconds =
      NOTIFY_FINISHED_ISSUE_PREPARATION_RETRY_DELAYS_MILLISECONDS.at(
        attemptNumber - 1,
      ) ?? null;
    try {
      await notifyOnce();
      return;
    } catch (error) {
      if (retryDelayMilliseconds === null) {
        dependencies.writeLine(
          `notifyFinishedIssuePreparation failed after ${attemptCount} attempts, orphaned-preparation detection will handle cleanup.`,
        );
        throw error;
      }
      dependencies.writeAttemptFailure(error);
      dependencies.writeLine(
        `notifyFinishedIssuePreparation failed, retrying in ${retryDelayMilliseconds / MILLISECONDS_PER_SECOND} seconds...`,
      );
    }
    await dependencies.sleep(retryDelayMilliseconds);
  }
};
