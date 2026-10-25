import { isRecord } from '../../domain/usecases/isRecord';

export type GithubRateLimitSignal = {
  resetAt: string | null;
};

export type GithubRateLimitResponse = {
  status: number;
  headers: Headers;
  body: unknown;
};

const DIGITS_PATTERN = /^\d+$/;
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit/i;

const isoStringOfEpochMilliseconds = (milliseconds: number): string | null => {
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const digitsHeaderValueOf = (headers: Headers, name: string): number | null => {
  const value = headers.get(name);
  return value !== null && DIGITS_PATTERN.test(value)
    ? Number.parseInt(value, 10)
    : null;
};

const resetAtOf = (headers: Headers, now: Date): string | null => {
  const resetEpochSeconds = digitsHeaderValueOf(headers, 'x-ratelimit-reset');
  const resetAt =
    resetEpochSeconds === null
      ? null
      : isoStringOfEpochMilliseconds(resetEpochSeconds * 1000);
  if (resetAt !== null) {
    return resetAt;
  }
  const retryAfterSeconds = digitsHeaderValueOf(headers, 'retry-after');
  return retryAfterSeconds === null
    ? null
    : isoStringOfEpochMilliseconds(now.getTime() + retryAfterSeconds * 1000);
};

const hasRateLimitMessage = (body: unknown): boolean =>
  isRecord(body) &&
  typeof body.message === 'string' &&
  RATE_LIMIT_MESSAGE_PATTERN.test(body.message);

const hasRateLimitedGraphqlError = (body: unknown): boolean => {
  const errors = isRecord(body) ? body.errors : undefined;
  return (
    Array.isArray(errors) &&
    errors.some(
      (error: unknown) => isRecord(error) && error.type === 'RATE_LIMITED',
    )
  );
};

export const githubRateLimitSignalOf = (
  response: GithubRateLimitResponse,
  now: Date,
): GithubRateLimitSignal | null => {
  const isRateLimited =
    (response.status === 403 &&
      (response.headers.get('x-ratelimit-remaining') === '0' ||
        hasRateLimitMessage(response.body))) ||
    response.status === 429 ||
    hasRateLimitedGraphqlError(response.body);
  return isRateLimited ? { resetAt: resetAtOf(response.headers, now) } : null;
};
