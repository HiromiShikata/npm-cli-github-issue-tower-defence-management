export const RATE_LIMIT_MAX_RETRIES = 3;
export const RATE_LIMIT_TOTAL_BACKOFF_CAP_MS = 5000;
export const RATE_LIMIT_BASE_BACKOFF_MS = 250;

const RATE_LIMIT_MESSAGE_PATTERN = /rate limit|secondary rate limit|abuse/i;

export type Sleep = (milliseconds: number) => Promise<void>;

export const realSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const parseNonNegativeIntegerHeader = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const hasRateLimitSignals = (
  status: number,
  headers: Headers,
  bodyText: string,
): boolean => {
  if (status !== 403 && status !== 429) {
    return false;
  }
  if (
    parseNonNegativeIntegerHeader(headers.get('x-ratelimit-remaining')) === 0
  ) {
    return true;
  }
  if (headers.get('retry-after') !== null) {
    return true;
  }
  return RATE_LIMIT_MESSAGE_PATTERN.test(bodyText);
};

export const computeRateLimitResetIso = (headers: Headers): string | null => {
  const resetEpochSeconds = parseNonNegativeIntegerHeader(
    headers.get('x-ratelimit-reset'),
  );
  if (resetEpochSeconds === null) {
    return null;
  }
  return new Date(resetEpochSeconds * 1000).toISOString();
};

export const computeBoundedBackoffMs = (
  headers: Headers,
  attempt: number,
  elapsedMs: number,
): number => {
  const remainingBudgetMs = RATE_LIMIT_TOTAL_BACKOFF_CAP_MS - elapsedMs;
  if (remainingBudgetMs <= 0) {
    return 0;
  }
  const exponentialMs = RATE_LIMIT_BASE_BACKOFF_MS * Math.pow(2, attempt);
  const retryAfterSeconds = parseNonNegativeIntegerHeader(
    headers.get('retry-after'),
  );
  const requestedMs =
    retryAfterSeconds !== null ? retryAfterSeconds * 1000 : exponentialMs;
  return Math.min(requestedMs, remainingBudgetMs);
};

export const fetchWithGitHubRateLimitRetry = async (
  request: () => Promise<Response>,
  sleep: Sleep = realSleep,
  now: () => number = Date.now,
): Promise<Response> => {
  const startMs = now();
  let attempt = 0;
  for (;;) {
    const response = await request();
    if (response.ok) {
      return response;
    }
    const bodyText = await response.clone().text();
    if (
      attempt >= RATE_LIMIT_MAX_RETRIES ||
      !hasRateLimitSignals(response.status, response.headers, bodyText)
    ) {
      return response;
    }
    const elapsedMs = now() - startMs;
    const backoffMs = computeBoundedBackoffMs(
      response.headers,
      attempt,
      elapsedMs,
    );
    if (backoffMs <= 0) {
      return response;
    }
    console.log(
      `GitHub returned ${response.status} (rate limit). Backing off ${backoffMs}ms before retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}.`,
    );
    await sleep(backoffMs);
    attempt++;
  }
};
