import { commentCreateWithDedupRetry } from './commentCreateWithDedupRetry';

type ExistingComment = { text: string; createdAt: Date };

const COMMENT_BODY = 'Auto Status Check: REJECTED';
const FIXED_NOW = new Date('2026-09-05T12:00:00Z');

const NO_DUPLICATE_COMMENTS: ReadonlyArray<ExistingComment> = [];
const DUPLICATE_COMMENTS: ReadonlyArray<ExistingComment> = [
  { text: COMMENT_BODY, createdAt: new Date(FIXED_NOW.getTime() - 1000) },
];

const clock = (): Date => FIXED_NOW;

const buildHttpError = (statusCode: number): Error =>
  Object.assign(
    new Error(
      `Failed to create comment via GitHub REST API: ${statusCode} Error`,
    ),
    {
      name: 'GitHubCommentCreateHttpError',
      statusCode,
    },
  );

const case4FourthAttemptError = buildHttpError(502);
const case8NotFoundError = buildHttpError(404);
const case9ValidationError = buildHttpError(422);

describe('commentCreateWithDedupRetry', () => {
  it.each<{
    label: string;
    fetchExisting: () => Promise<ReadonlyArray<ExistingComment>>;
    postComment: () => Promise<void>;
    expectedOutcome: 'resolves' | { rejectsWith: Error };
    expectedFetchExistingCallCount: number;
    expectedPostCommentCallCount: number;
    expectedSleepCallCount: number;
  }>([
    {
      label: 'succeeds immediately when the first attempt is 201',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockResolvedValueOnce(undefined),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 1,
      expectedPostCommentCallCount: 1,
      expectedSleepCallCount: 0,
    },
    {
      label:
        'does not re-post when a 502 is followed by a duplicate found on re-check',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS)
        .mockResolvedValueOnce(DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(502)),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 2,
      expectedPostCommentCallCount: 1,
      expectedSleepCallCount: 1,
    },
    {
      label:
        'retries once and succeeds on the 2nd attempt when the re-check after a 502 finds no duplicate',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS)
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(502))
        .mockResolvedValueOnce(undefined),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 2,
      expectedPostCommentCallCount: 2,
      expectedSleepCallCount: 1,
    },
    {
      label:
        'stops after the retry budget of 3 retries is exhausted and rethrows the 4th attempt 502 unmodified',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValue(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(502))
        .mockRejectedValueOnce(buildHttpError(502))
        .mockRejectedValueOnce(buildHttpError(502))
        .mockRejectedValueOnce(case4FourthAttemptError),
      expectedOutcome: { rejectsWith: case4FourthAttemptError },
      expectedFetchExistingCallCount: 4,
      expectedPostCommentCallCount: 4,
      expectedSleepCallCount: 3,
    },
    {
      label: 'retries a 500 the same as a 502',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS)
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(500))
        .mockResolvedValueOnce(undefined),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 2,
      expectedPostCommentCallCount: 2,
      expectedSleepCallCount: 1,
    },
    {
      label: 'retries a 503 the same as a 502',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS)
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(503))
        .mockResolvedValueOnce(undefined),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 2,
      expectedPostCommentCallCount: 2,
      expectedSleepCallCount: 1,
    },
    {
      label: 'retries a 504 the same as a 502',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS)
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(buildHttpError(504))
        .mockResolvedValueOnce(undefined),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 2,
      expectedPostCommentCallCount: 2,
      expectedSleepCallCount: 1,
    },
    {
      label: 'does not retry a 404 and propagates the error immediately',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(case8NotFoundError),
      expectedOutcome: { rejectsWith: case8NotFoundError },
      expectedFetchExistingCallCount: 1,
      expectedPostCommentCallCount: 1,
      expectedSleepCallCount: 0,
    },
    {
      label:
        'does not retry a 422 validation error and propagates the error immediately',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(NO_DUPLICATE_COMMENTS),
      postComment: jest
        .fn<Promise<void>, []>()
        .mockRejectedValueOnce(case9ValidationError),
      expectedOutcome: { rejectsWith: case9ValidationError },
      expectedFetchExistingCallCount: 1,
      expectedPostCommentCallCount: 1,
      expectedSleepCallCount: 0,
    },
    {
      label:
        'never calls postComment when a duplicate already exists before the first attempt',
      fetchExisting: jest
        .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
        .mockResolvedValueOnce(DUPLICATE_COMMENTS),
      postComment: jest.fn<Promise<void>, []>(),
      expectedOutcome: 'resolves',
      expectedFetchExistingCallCount: 1,
      expectedPostCommentCallCount: 0,
      expectedSleepCallCount: 0,
    },
  ])(
    '$label',
    async ({
      fetchExisting,
      postComment,
      expectedOutcome,
      expectedFetchExistingCallCount,
      expectedPostCommentCallCount,
      expectedSleepCallCount,
    }) => {
      const sleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);

      const resultPromise = commentCreateWithDedupRetry(
        COMMENT_BODY,
        fetchExisting,
        postComment,
        clock,
        sleep,
      );

      if (expectedOutcome === 'resolves') {
        await expect(resultPromise).resolves.toBeUndefined();
      } else {
        await expect(resultPromise).rejects.toBe(expectedOutcome.rejectsWith);
      }

      expect(fetchExisting).toHaveBeenCalledTimes(
        expectedFetchExistingCallCount,
      );
      expect(postComment).toHaveBeenCalledTimes(expectedPostCommentCallCount);
      expect(sleep).toHaveBeenCalledTimes(expectedSleepCallCount);
    },
  );

  it('forwards an explicit windowMs override to the duplicate check, so a comment that is within the default 2-hour window but outside the shorter override window is not treated as a duplicate', async () => {
    const existingCommentWithinDefaultWindow: ReadonlyArray<ExistingComment> =
      [
        {
          text: COMMENT_BODY,
          createdAt: new Date(FIXED_NOW.getTime() - 90 * 60 * 1000),
        },
      ];
    const fetchExisting = jest
      .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
      .mockResolvedValueOnce(existingCommentWithinDefaultWindow);
    const postComment = jest
      .fn<Promise<void>, []>()
      .mockResolvedValueOnce(undefined);
    const sleep = jest
      .fn<Promise<void>, [number]>()
      .mockResolvedValue(undefined);
    const sixtyMinuteWindowMs = 60 * 60 * 1000;

    await commentCreateWithDedupRetry(
      COMMENT_BODY,
      fetchExisting,
      postComment,
      clock,
      sleep,
      sixtyMinuteWindowMs,
    );

    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it('forwards an explicit null windowMs override to the duplicate check, so a comment outside the default 2-hour window is still treated as a duplicate and never re-posted', async () => {
    const existingCommentOutsideDefaultWindow: ReadonlyArray<ExistingComment> =
      [
        {
          text: COMMENT_BODY,
          createdAt: new Date(FIXED_NOW.getTime() - 3 * 60 * 60 * 1000),
        },
      ];
    const fetchExisting = jest
      .fn<Promise<ReadonlyArray<ExistingComment>>, []>()
      .mockResolvedValueOnce(existingCommentOutsideDefaultWindow);
    const postComment = jest.fn<Promise<void>, []>();
    const sleep = jest
      .fn<Promise<void>, [number]>()
      .mockResolvedValue(undefined);

    await commentCreateWithDedupRetry(
      COMMENT_BODY,
      fetchExisting,
      postComment,
      clock,
      sleep,
      null,
    );

    expect(postComment).not.toHaveBeenCalled();
  });
});
