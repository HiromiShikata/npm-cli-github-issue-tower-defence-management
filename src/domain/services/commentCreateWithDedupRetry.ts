import { isDuplicateWithinWindow } from './commentDeduplication';

export type Sleep = (milliseconds: number) => Promise<void>;

export const realSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([
  500, 502, 503, 504,
]);

export const COMMENT_CREATE_RETRY_MAX_RETRIES = 3;
export const COMMENT_CREATE_RETRY_BASE_BACKOFF_MS = 250;
export const COMMENT_CREATE_RETRY_TOTAL_BACKOFF_CAP_MS = 5000;

const isRetryableCommentCreateError = (error: unknown): boolean =>
  error instanceof Error &&
  error.name === 'GitHubCommentCreateHttpError' &&
  'statusCode' in error &&
  typeof error.statusCode === 'number' &&
  RETRYABLE_STATUS_CODES.has(error.statusCode);

export async function commentCreateWithDedupRetry(
  commentBody: string,
  fetchExisting: () => Promise<
    ReadonlyArray<{ text: string; createdAt: Date }>
  >,
  postComment: () => Promise<void>,
  clock: () => Date,
  sleep: Sleep,
): Promise<void> {
  const isDuplicateNow = async (): Promise<boolean> => {
    const existing = await fetchExisting();
    return isDuplicateWithinWindow(commentBody, existing, clock());
  };

  if (await isDuplicateNow()) {
    return;
  }

  let attempt = 0;
  for (;;) {
    try {
      await postComment();
      return;
    } catch (error: unknown) {
      const retryable = isRetryableCommentCreateError(error);
      if (!retryable || attempt >= COMMENT_CREATE_RETRY_MAX_RETRIES) {
        throw error;
      }
      await sleep(
        Math.min(
          COMMENT_CREATE_RETRY_BASE_BACKOFF_MS * 2 ** attempt,
          COMMENT_CREATE_RETRY_TOTAL_BACKOFF_CAP_MS,
        ),
      );
      attempt++;
      if (await isDuplicateNow()) {
        return;
      }
    }
  }
}
