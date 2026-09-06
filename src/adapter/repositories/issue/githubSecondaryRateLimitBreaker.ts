import * as fs from 'node:fs';
import * as path from 'node:path';
import { tdpmCacheDirectory } from '../localStorageCacheDirectory';

/**
 * Environment variable that overrides the path of the shared secondary rate
 * limit state file.  When absent the file lives under the TDPM cache
 * directory so all processes on the host share the same path automatically.
 */
export const SECONDARY_RATE_LIMIT_STATE_FILE_ENV_VAR =
  'TDPM_GH_SECONDARY_RATE_LIMIT_STATE_FILE';

/**
 * State older than this is treated as non-blocking.  A crashed writer cannot
 * wedge the fleet permanently beyond one hour.
 */
export const STALE_STATE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface SecondaryRateLimitState {
  /** Epoch milliseconds at which the block expires (or should have expired). */
  resetTimeMs: number;
  /** Epoch milliseconds at which the block was first detected. */
  detectedAtMs: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isSecondaryRateLimitState = (
  value: unknown,
): value is SecondaryRateLimitState => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.resetTimeMs === 'number' &&
    typeof value.detectedAtMs === 'number'
  );
};

export const secondaryRateLimitStateFilePath = (): string =>
  process.env[SECONDARY_RATE_LIMIT_STATE_FILE_ENV_VAR] ??
  path.join(tdpmCacheDirectory(), 'gh-secondary-rate-limit.json');

/**
 * Reads the shared state file.  Returns null on any I/O or parse error so
 * the caller always falls back to the non-blocking path rather than
 * crashing.
 */
export const readSecondaryRateLimitState = (
  filePath: string = secondaryRateLimitStateFilePath(),
): SecondaryRateLimitState | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return isSecondaryRateLimitState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Writes the state file atomically (temp-file then rename) so a concurrent
 * reader never sees a partial file.  Errors are swallowed: failure to write
 * means other processes simply do not benefit from this detection, which
 * degrades gracefully to the pre-breaker behaviour.
 */
export const writeSecondaryRateLimitState = (
  resetTimeMs: number,
  detectedAtMs: number,
  filePath: string = secondaryRateLimitStateFilePath(),
): void => {
  const state: SecondaryRateLimitState = { resetTimeMs, detectedAtMs };
  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = path.join(
      dir,
      `.gh-secondary-rate-limit-${process.pid}.tmp`,
    );
    fs.writeFileSync(tmpPath, JSON.stringify(state), { encoding: 'utf8' });
    fs.renameSync(tmpPath, filePath);
  } catch {
    // Best-effort: if the write fails, the breaker simply does not protect
    // other processes for this block.
  }
};

export interface SecondaryRateLimitBreakerResult {
  isBlocked: boolean;
  /** Present only when isBlocked is true. */
  resetTimeMs: number | null;
}

/**
 * Checks whether a previously recorded secondary rate limit block is still
 * active.
 *
 * Returns { isBlocked: false } in every error or edge case:
 *   - State file is missing, unreadable, or malformed.
 *   - State file is stale (detectedAtMs more than one hour ago).
 *   - Reset time has already passed.
 *
 * This ensures a crashed or hung writer cannot wedge the fleet permanently.
 */
export const checkSecondaryRateLimitBreaker = (
  nowMs: number,
  filePath: string = secondaryRateLimitStateFilePath(),
): SecondaryRateLimitBreakerResult => {
  const state = readSecondaryRateLimitState(filePath);

  if (state === null) {
    return { isBlocked: false, resetTimeMs: null };
  }

  // Guard against a stale file left by a crashed writer
  if (nowMs - state.detectedAtMs > STALE_STATE_MAX_AGE_MS) {
    return { isBlocked: false, resetTimeMs: null };
  }

  // Block has expired
  if (nowMs >= state.resetTimeMs) {
    return { isBlocked: false, resetTimeMs: null };
  }

  return { isBlocked: true, resetTimeMs: state.resetTimeMs };
};
