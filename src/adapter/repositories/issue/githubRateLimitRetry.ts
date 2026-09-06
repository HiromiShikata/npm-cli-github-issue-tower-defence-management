import {
  checkSecondaryRateLimitBreaker,
  secondaryRateLimitStateFilePath,
  writeSecondaryRateLimitState,
} from './githubSecondaryRateLimitBreaker';

export class GitHubRateLimitError extends Error {
  readonly name = 'GitHubRateLimitError';
  readonly rateLimitResetAt: string | null;

  constructor(message: string, rateLimitResetAt: string | null = null) {
    super(message);
    this.rateLimitResetAt = rateLimitResetAt;
  }
}

export const RATE_LIMIT_MAX_RETRIES = 3;
export const RATE_LIMIT_TOTAL_BACKOFF_CAP_MS = 5000;
export const RATE_LIMIT_BASE_BACKOFF_MS = 250;
export const SECONDARY_RATE_LIMIT_FLOOR_MS = 60_000;

const RATE_LIMIT_MESSAGE_PATTERN = /rate limit|secondary rate limit|abuse/i;
const SECONDARY_RATE_LIMIT_BODY_PATTERN =
  /secondary rate limit|abuse detection/i;

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

/**
 * Returns true when the response indicates a secondary (content-creation)
 * rate limit, detected by two signals:
 *   1. Response body matches SECONDARY_RATE_LIMIT_BODY_PATTERN — covers both
 *      the current "secondary rate limit" phrasing and the historical
 *      "abuse detection mechanism" phrasing GitHub used before standardising
 *      its error messages.  GitHub's REST API documentation does not guarantee
 *      exact response body wording.
 *   2. A retry-after header is present.
 *
 * Secondary rate limits require a minimum 60-second wait before any retry,
 * which is incompatible with the 5-second primary-limit budget cap.
 *
 * Note: x-ratelimit-remaining=0 with a future x-ratelimit-reset and no
 * retry-after is the primary hourly-quota exhaustion signature, NOT a
 * secondary rate limit.  That case is handled separately in
 * fetchWithGitHubRateLimitRetry to avoid contaminating the shared circuit
 * breaker state file with a primary-quota event.
 */
export const isSecondaryRateLimit = (
  headers: Headers,
  bodyText: string,
): boolean => {
  // Signal 1: body explicitly names the secondary rate limit
  if (SECONDARY_RATE_LIMIT_BODY_PATTERN.test(bodyText)) {
    return true;
  }
  // Signal 2: retry-after header is present
  if (headers.get('retry-after') !== null) {
    return true;
  }
  return false;
};

/**
 * Computes how long to wait before retrying after a secondary rate limit
 * response.  Respects retry-after and x-ratelimit-reset when present, and
 * enforces a minimum of SECONDARY_RATE_LIMIT_FLOOR_MS (60 s) regardless of
 * what the headers say, as required by the GitHub REST API documentation.
 * The 5-second primary-limit budget cap does NOT apply here.
 */
export const computeSecondaryRateLimitBackoffMs = (
  headers: Headers,
  nowMs: number,
): number => {
  // Prefer retry-after if the server provided one
  const retryAfterSeconds = parseNonNegativeIntegerHeader(
    headers.get('retry-after'),
  );
  if (retryAfterSeconds !== null) {
    return Math.max(retryAfterSeconds * 1000, SECONDARY_RATE_LIMIT_FLOOR_MS);
  }
  // Fall back to computing the wait from x-ratelimit-reset
  const resetEpochSeconds = parseNonNegativeIntegerHeader(
    headers.get('x-ratelimit-reset'),
  );
  if (resetEpochSeconds !== null) {
    const waitMs = resetEpochSeconds * 1000 - nowMs;
    return Math.max(waitMs, SECONDARY_RATE_LIMIT_FLOOR_MS);
  }
  // No header guidance available: use the floor
  return SECONDARY_RATE_LIMIT_FLOOR_MS;
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

/**
 * Wraps a GitHub API request with rate-limit-aware retry logic.
 *
 * Two classes of rate limit are handled differently:
 *
 * Secondary rate limits (content-creation blocks) — detected by
 * `isSecondaryRateLimit` — require a minimum 60-second wait which exceeds
 * the primary-limit budget cap.  When `retryOnSecondaryRateLimit` is false
 * (the default, appropriate for interactive console operations) the function
 * returns the error response immediately without retrying, so exactly one
 * request is spent and the caller can surface the reset timestamp to the
 * user.  When true, up to RATE_LIMIT_MAX_RETRIES retries are performed with
 * `computeSecondaryRateLimitBackoffMs` (60-second floor, no budget cap).
 *
 * Circuit breaker (content-creating requests only):
 * When `isContentCreating` is true, the function checks a shared on-disk
 * state file before issuing the request.  If another process has already
 * recorded an active secondary rate limit block, the request is not issued
 * and a synthetic 403 response is returned immediately, naming the reset
 * time.  When a secondary rate limit is detected in a response, the block
 * is written to the shared state file so every other process on the host
 * benefits from the discovery.
 *
 * Primary rate limits follow the original sub-second exponential schedule
 * bounded by RATE_LIMIT_TOTAL_BACKOFF_CAP_MS.  Non-rate-limit failures are
 * returned immediately without retrying.
 */
export const fetchWithGitHubRateLimitRetry = async (
  request: () => Promise<Response>,
  sleep: Sleep = realSleep,
  now: () => number = Date.now,
  retryOnSecondaryRateLimit: boolean = false,
  isContentCreating: boolean = false,
  stateFilePath: string = secondaryRateLimitStateFilePath(),
): Promise<Response> => {
  const startMs = now();
  let attempt = 0;
  for (;;) {
    // Circuit breaker: before the first request attempt, check whether another
    // process has already recorded a live secondary rate limit block.  This
    // prevents the fleet from hammering GitHub in parallel once one process
    // has discovered the block.  The check is limited to the first attempt so
    // that the non-interactive retry path (retryOnSecondaryRateLimit: true)
    // can honour its own recorded wait without blocking itself on a state it
    // just wrote.
    if (isContentCreating && attempt === 0) {
      const nowBeforeMs = now();
      const breaker = checkSecondaryRateLimitBreaker(
        nowBeforeMs,
        stateFilePath,
      );
      if (breaker.isBlocked && breaker.resetTimeMs !== null) {
        const resetIso = new Date(breaker.resetTimeMs).toISOString();
        return new Response(
          JSON.stringify({
            message: `GitHub secondary rate limit is active until ${resetIso}; retry later`,
          }),
          { status: 403 },
        );
      }
    }

    const response = await request();
    if (response.ok) {
      return response;
    }
    const bodyText = await response.clone().text();
    const nowMs = now();

    // Secondary rate limit detection and circuit-breaker writes are scoped to
    // content-creating operations.  Read operations (isContentCreating: false)
    // fall directly through to the primary rate-limit handler so that a
    // transient 429/retry-after on a read is still retried rather than
    // silently dropped.  Secondary rate limits are caused exclusively by
    // content-creation activity, so detecting them on reads would produce
    // false positives and contaminate the shared state file.
    if (isContentCreating && isSecondaryRateLimit(response.headers, bodyText)) {
      // Record the block in the shared state file so other processes on this
      // host can skip their pending content-creating requests immediately.
      const backoffMs = computeSecondaryRateLimitBackoffMs(
        response.headers,
        nowMs,
      );
      writeSecondaryRateLimitState(nowMs + backoffMs, nowMs, stateFilePath);

      if (!retryOnSecondaryRateLimit) {
        // Interactive callers: fail immediately so the reset timestamp
        // already present in the error message reaches the user without
        // spending three more blocked requests across two seconds.
        return response;
      }
      if (attempt >= RATE_LIMIT_MAX_RETRIES) {
        return response;
      }
      console.log(
        `GitHub returned ${response.status} (secondary rate limit). Backing off ${backoffMs}ms before retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}.`,
      );
      await sleep(backoffMs);
      attempt++;
      continue;
    }

    // Primary hourly-quota exhaustion: x-ratelimit-remaining is 0 with a
    // future x-ratelimit-reset and no retry-after means the hourly quota is
    // fully spent.  The reset is up to 3,600 s away, making the 250/500/1000 ms
    // sub-second backoff useless — four identical blocked requests are spent for
    // no gain.  Return immediately so the caller surfaces the reset time.
    //
    // Discriminator from the secondary case: secondary rate limits carry
    // retry-after (signal 2) or an explicit secondary-rate-limit body phrase
    // (signal 1) and are already handled above when isContentCreating is true.
    // A response with neither — only remaining=0 and a future reset — is a
    // primary exhaustion.
    const quotaRemaining = parseNonNegativeIntegerHeader(
      response.headers.get('x-ratelimit-remaining'),
    );
    const resetEpoch = parseNonNegativeIntegerHeader(
      response.headers.get('x-ratelimit-reset'),
    );
    if (
      quotaRemaining === 0 &&
      response.headers.get('retry-after') === null &&
      resetEpoch !== null &&
      resetEpoch * 1000 > nowMs
    ) {
      return response;
    }

    // Primary rate limit or other transient error: existing sub-second
    // exponential schedule bounded by RATE_LIMIT_TOTAL_BACKOFF_CAP_MS.
    if (
      attempt >= RATE_LIMIT_MAX_RETRIES ||
      !hasRateLimitSignals(response.status, response.headers, bodyText)
    ) {
      return response;
    }
    const elapsedMs = nowMs - startMs;
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
