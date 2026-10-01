import {
  NOTIFY_FINISHED_ISSUE_PREPARATION_RETRY_DELAYS_MILLISECONDS,
  notifyFinishedIssuePreparationRunWithRetry,
} from './notifyFinishedIssuePreparationRetry';

const firstAttemptLine =
  'Calling notifyFinishedIssuePreparation (attempt 1/3)...';
const retryingInThirtySecondsLine =
  'notifyFinishedIssuePreparation failed, retrying in 30 seconds...';
const failedAfterThreeAttemptsLine =
  'notifyFinishedIssuePreparation failed after 3 attempts, orphaned-preparation detection will handle cleanup.';

const runWithRecordedDependencies = (
  notifyOnce: () => Promise<void>,
): {
  completion: Promise<void>;
  sleptMilliseconds: number[];
  writtenLines: string[];
  reportedAttemptFailures: unknown[];
  timeline: string[];
} => {
  const sleptMilliseconds: number[] = [];
  const writtenLines: string[] = [];
  const reportedAttemptFailures: unknown[] = [];
  const timeline: string[] = [];
  const completion = notifyFinishedIssuePreparationRunWithRetry(
    async () => {
      timeline.push('notify');
      await notifyOnce();
    },
    {
      sleep: async (milliseconds) => {
        timeline.push(`sleep ${milliseconds}`);
        sleptMilliseconds.push(milliseconds);
      },
      writeLine: (line) => {
        writtenLines.push(line);
      },
      writeAttemptFailure: (error) => {
        reportedAttemptFailures.push(error);
      },
    },
  );
  return {
    completion,
    sleptMilliseconds,
    writtenLines,
    reportedAttemptFailures,
    timeline,
  };
};

describe('notifyFinishedIssuePreparationRunWithRetry', () => {
  it('declares the waits before the second and third attempts as 30 and 60 seconds', () => {
    expect(NOTIFY_FINISHED_ISSUE_PREPARATION_RETRY_DELAYS_MILLISECONDS).toEqual(
      [30000, 60000],
    );
  });

  it('calls the notification once without sleeping when it resolves at once', async () => {
    const notifyOnce = jest.fn<Promise<void>, []>().mockResolvedValue();

    const run = runWithRecordedDependencies(notifyOnce);

    await expect(run.completion).resolves.toBeUndefined();
    expect(notifyOnce).toHaveBeenCalledTimes(1);
    expect(run.sleptMilliseconds).toEqual([]);
    expect(run.writtenLines).toEqual([firstAttemptLine]);
    expect(run.reportedAttemptFailures).toEqual([]);
  });

  it('retries once after 30 seconds when the first attempt rejects and the second resolves', async () => {
    const firstAttemptError = new Error('GitHub API returned 502');
    const notifyOnce = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(firstAttemptError)
      .mockResolvedValueOnce();

    const run = runWithRecordedDependencies(notifyOnce);

    await expect(run.completion).resolves.toBeUndefined();
    expect(notifyOnce).toHaveBeenCalledTimes(2);
    expect(run.sleptMilliseconds).toEqual([30000]);
    expect(run.timeline).toEqual(['notify', 'sleep 30000', 'notify']);
    expect(run.reportedAttemptFailures).toContain(firstAttemptError);
    expect(run.writtenLines).toContain(firstAttemptLine);
    expect(run.writtenLines).toContain(retryingInThirtySecondsLine);
  });

  it('gives up after three rejected attempts, sleeping 30 and then 60 seconds, and rejects with the third error', async () => {
    const firstAttemptError = new Error('GitHub API returned 502');
    const secondAttemptError = new Error('GitHub API returned 503');
    const thirdAttemptError = new Error('GitHub API returned 504');
    const notifyOnce = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(firstAttemptError)
      .mockRejectedValueOnce(secondAttemptError)
      .mockRejectedValueOnce(thirdAttemptError);

    const run = runWithRecordedDependencies(notifyOnce);

    await expect(run.completion).rejects.toBe(thirdAttemptError);
    expect(notifyOnce).toHaveBeenCalledTimes(3);
    expect(run.sleptMilliseconds).toEqual([30000, 60000]);
    expect(run.timeline).toEqual([
      'notify',
      'sleep 30000',
      'notify',
      'sleep 60000',
      'notify',
    ]);
    expect(run.reportedAttemptFailures).toEqual(
      expect.arrayContaining([firstAttemptError, secondAttemptError]),
    );
    expect(run.writtenLines).toContain(failedAfterThreeAttemptsLine);
  });
});
