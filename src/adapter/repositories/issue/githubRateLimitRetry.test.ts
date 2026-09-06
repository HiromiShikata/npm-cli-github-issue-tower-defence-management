import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  hasRateLimitSignals,
  isSecondaryRateLimit,
  computeBoundedBackoffMs,
  computeSecondaryRateLimitBackoffMs,
  computeRateLimitResetIso,
  fetchWithGitHubRateLimitRetry,
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_TOTAL_BACKOFF_CAP_MS,
  SECONDARY_RATE_LIMIT_FLOOR_MS,
} from './githubRateLimitRetry';
import { readSecondaryRateLimitState } from './githubSecondaryRateLimitBreaker';

// Isolated temp directory for any state-file side-effects produced by the
// functions under test.  Using an isolated path prevents writes from leaking
// into the real TDPM cache directory.
let tmpDir: string;
let tmpStateFile: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-ratelimit-test-'));
  tmpStateFile = path.join(tmpDir, 'gh-secondary-rate-limit.json');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe('githubRateLimitRetry', () => {
  describe('hasRateLimitSignals', () => {
    it('detects a 403 with x-ratelimit-remaining: 0', () => {
      const headers = new Headers({ 'x-ratelimit-remaining': '0' });
      expect(hasRateLimitSignals(403, headers, '')).toBe(true);
    });

    it('detects a 429 with a Retry-After header', () => {
      const headers = new Headers({ 'retry-after': '2' });
      expect(hasRateLimitSignals(429, headers, '')).toBe(true);
    });

    it('detects a secondary rate limit message in the body', () => {
      const headers = new Headers();
      expect(
        hasRateLimitSignals(
          403,
          headers,
          JSON.stringify({
            message: 'You have exceeded a secondary rate limit',
          }),
        ),
      ).toBe(true);
    });

    it('does not flag a 403 without any rate-limit signal', () => {
      const headers = new Headers({ 'x-ratelimit-remaining': '4999' });
      expect(
        hasRateLimitSignals(
          403,
          headers,
          JSON.stringify({ message: 'Resource not accessible by integration' }),
        ),
      ).toBe(false);
    });

    it('does not flag non-403/429 statuses', () => {
      const headers = new Headers({ 'retry-after': '2' });
      expect(hasRateLimitSignals(404, headers, 'rate limit')).toBe(false);
    });
  });

  describe('isSecondaryRateLimit', () => {
    it('detects signal 1: body containing "secondary rate limit"', () => {
      const headers = new Headers();
      expect(
        isSecondaryRateLimit(
          headers,
          JSON.stringify({
            message: 'You have exceeded a secondary rate limit',
          }),
        ),
      ).toBe(true);
    });

    it('detects signal 1 case-insensitively', () => {
      const headers = new Headers();
      expect(
        isSecondaryRateLimit(headers, 'Secondary Rate Limit triggered'),
      ).toBe(true);
    });

    it('detects signal 2: retry-after header present', () => {
      const headers = new Headers({ 'retry-after': '60' });
      expect(isSecondaryRateLimit(headers, '')).toBe(true);
    });

    it('detects signal 2 even when retry-after is zero', () => {
      const headers = new Headers({ 'retry-after': '0' });
      expect(isSecondaryRateLimit(headers, '')).toBe(true);
    });

    it('returns false for primary quota exhaustion: remaining=0, future reset, no retry-after, no secondary body', () => {
      const futureResetEpoch = Math.floor(Date.now() / 1000) + 3600;
      const headers = new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(futureResetEpoch),
      });
      expect(isSecondaryRateLimit(headers, '')).toBe(false);
    });

    it('returns false for primary quota exhaustion when x-ratelimit-reset is absent', () => {
      const headers = new Headers({ 'x-ratelimit-remaining': '0' });
      expect(
        isSecondaryRateLimit(
          headers,
          JSON.stringify({ message: 'API rate limit exceeded' }),
        ),
      ).toBe(false);
    });

    it('does not flag a generic permission 403 with no rate-limit signals', () => {
      const headers = new Headers({ 'x-ratelimit-remaining': '4999' });
      expect(
        isSecondaryRateLimit(
          headers,
          JSON.stringify({ message: 'Resource not accessible by integration' }),
        ),
      ).toBe(false);
    });

    it('detects signal 1 from abuse detection mechanism body phrase without retry-after header', () => {
      const headers = new Headers();
      expect(
        isSecondaryRateLimit(
          headers,
          JSON.stringify({
            message: 'You have triggered an abuse detection mechanism',
          }),
        ),
      ).toBe(true);
    });

    it('does not flag body containing bare "abuse" without "detection"', () => {
      const headers = new Headers();
      expect(
        isSecondaryRateLimit(
          headers,
          JSON.stringify({ message: 'This is considered abuse of the API' }),
        ),
      ).toBe(false);
    });
  });

  describe('computeSecondaryRateLimitBackoffMs', () => {
    const nowMs = 1_000_000;

    it('enforces the 60-second floor when retry-after is shorter', () => {
      const headers = new Headers({ 'retry-after': '1' });
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(
        SECONDARY_RATE_LIMIT_FLOOR_MS,
      );
    });

    it('honours retry-after when it exceeds the 60-second floor', () => {
      const headers = new Headers({ 'retry-after': '90' });
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(90_000);
    });

    it('enforces the 60-second floor when x-ratelimit-reset gives fewer than 60 s', () => {
      const resetEpochSeconds = Math.floor(nowMs / 1000) + 30;
      const headers = new Headers({
        'x-ratelimit-reset': String(resetEpochSeconds),
      });
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(
        SECONDARY_RATE_LIMIT_FLOOR_MS,
      );
    });

    it('uses x-ratelimit-reset when the wait exceeds the 60-second floor', () => {
      const resetEpochSeconds = Math.floor(nowMs / 1000) + 90;
      const headers = new Headers({
        'x-ratelimit-reset': String(resetEpochSeconds),
      });
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(90_000);
    });

    it('returns the 60-second floor when no relevant headers are present', () => {
      const headers = new Headers();
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(
        SECONDARY_RATE_LIMIT_FLOOR_MS,
      );
    });

    it('prefers retry-after over x-ratelimit-reset when both are present', () => {
      const resetEpochSeconds = Math.floor(nowMs / 1000) + 120;
      const headers = new Headers({
        'retry-after': '90',
        'x-ratelimit-reset': String(resetEpochSeconds),
      });
      // retry-after wins: 90 s > 60 s floor
      expect(computeSecondaryRateLimitBackoffMs(headers, nowMs)).toBe(90_000);
    });
  });

  describe('computeBoundedBackoffMs', () => {
    it('grows exponentially from the base when no Retry-After is present', () => {
      const headers = new Headers();
      expect(computeBoundedBackoffMs(headers, 0, 0)).toBe(250);
      expect(computeBoundedBackoffMs(headers, 1, 0)).toBe(500);
      expect(computeBoundedBackoffMs(headers, 2, 0)).toBe(1000);
    });

    it('honors Retry-After only within the remaining budget', () => {
      const headers = new Headers({ 'retry-after': '2' });
      expect(computeBoundedBackoffMs(headers, 0, 0)).toBe(2000);
    });

    it('caps the wait so the total never exceeds the budget', () => {
      const headers = new Headers({ 'retry-after': '3600' });
      expect(computeBoundedBackoffMs(headers, 0, 4000)).toBe(
        RATE_LIMIT_TOTAL_BACKOFF_CAP_MS - 4000,
      );
    });

    it('returns 0 when the backoff budget is exhausted', () => {
      const headers = new Headers({ 'retry-after': '3600' });
      expect(
        computeBoundedBackoffMs(headers, 0, RATE_LIMIT_TOTAL_BACKOFF_CAP_MS),
      ).toBe(0);
    });
  });

  describe('computeRateLimitResetIso', () => {
    it('converts the x-ratelimit-reset epoch seconds to an ISO timestamp', () => {
      const headers = new Headers({ 'x-ratelimit-reset': '1700000000' });
      expect(computeRateLimitResetIso(headers)).toBe(
        new Date(1700000000 * 1000).toISOString(),
      );
    });

    it('returns null when no reset header is present', () => {
      expect(computeRateLimitResetIso(new Headers())).toBeNull();
    });
  });

  describe('fetchWithGitHubRateLimitRetry', () => {
    // Clear the shared state file before each test so circuit-breaker state
    // from one test does not contaminate the next.
    beforeEach(() => {
      try {
        fs.unlinkSync(tmpStateFile);
      } catch {
        // File may not exist yet; that is fine.
      }
    });

    // Primary rate limit: x-ratelimit-remaining:0 without x-ratelimit-reset.
    // isSecondaryRateLimit → false; hasRateLimitSignals → true.
    const primaryRateLimitResponse = (): Response =>
      new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      });

    // Secondary rate limit: body names it explicitly.
    const secondaryRateLimitBodyResponse = (): Response =>
      new Response(
        JSON.stringify({ message: 'You have exceeded a secondary rate limit' }),
        { status: 403 },
      );

    // Secondary rate limit: retry-after header present.
    const secondaryRateLimitRetryAfterResponse = (): Response =>
      new Response(JSON.stringify({ message: 'Content creation rate limit' }), {
        status: 403,
        headers: { 'retry-after': '60' },
      });

    // Secondary rate limit detection is scoped to content-creating operations
    // (isContentCreating: true).  Passing true here mirrors the real call path
    // that approvePullRequest, mergePullRequest, etc. exercise.

    it('returns immediately on a secondary rate limit body signal without retrying', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValue(secondaryRateLimitBodyResponse());

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating
        tmpStateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('returns immediately on a secondary rate limit retry-after signal without retrying', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValue(secondaryRateLimitRetryAfterResponse());

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating
        tmpStateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    // --- Non-interactive (retryOnSecondaryRateLimit: true) path ---

    it('retries a secondary rate limit with a wait of at least 60 seconds when retryOnSecondaryRateLimit is true', async () => {
      const sleeps: number[] = [];
      const sleep = jest.fn(async (ms: number) => {
        sleeps.push(ms);
      });
      const request = jest
        .fn<Promise<Response>, []>()
        // retry-after of 1 s — the floor must raise this to 60 s
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ message: 'secondary rate limit exceeded' }),
            { status: 403, headers: { 'retry-after': '1' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        true, // retryOnSecondaryRateLimit
        true, // isContentCreating
        tmpStateFile,
      );

      expect(response.status).toBe(200);
      expect(request).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleeps[0]).toBeGreaterThanOrEqual(SECONDARY_RATE_LIMIT_FLOOR_MS);
    });

    // --- Primary hourly-quota exhaustion ---

    it('returns immediately without retrying when x-ratelimit-remaining is 0, x-ratelimit-reset is in the future, and no retry-after is present (primary exhaustion)', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const futureReset = Math.floor(Date.now() / 1000) + 3600;
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(futureReset),
          },
        }),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('still retries when retry-after is present alongside x-ratelimit-remaining 0 (secondary, not primary exhaustion)', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'rate limit' }), {
            status: 403,
            headers: {
              'x-ratelimit-remaining': '0',
              'retry-after': '60',
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );

      // retry-after signals the secondary case; primary-exhaustion guard must
      // not fire, leaving the normal retry path to recover on the second attempt
      expect(response.status).toBe(200);
      expect(request).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('does not write the breaker state file on primary exhaustion even when isContentCreating is true', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const futureReset = Math.floor(Date.now() / 1000) + 3600;
      const stateFile = path.join(tmpDir, 'no-write-primary-exhaustion.json');
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(futureReset),
          },
        }),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating: primary exhaustion must NOT be treated as secondary
        stateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(fs.existsSync(stateFile)).toBe(false);
    });

    it('writes the breaker state file when body signals secondary rate limit and isContentCreating is true', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const stateFile = path.join(tmpDir, 'write-secondary-body.json');
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'You have exceeded a secondary rate limit',
          }),
          { status: 403 },
        ),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating
        stateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(fs.existsSync(stateFile)).toBe(true);
      const state = readSecondaryRateLimitState(stateFile);
      expect(state).not.toBeNull();
      expect(typeof state?.resetTimeMs).toBe('number');
    });

    it('writes the breaker state file when retry-after signals secondary rate limit and isContentCreating is true', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const stateFile = path.join(tmpDir, 'write-secondary-retry-after.json');
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(JSON.stringify({ message: 'rate limit' }), {
          status: 403,
          headers: { 'retry-after': '60' },
        }),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating
        stateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(fs.existsSync(stateFile)).toBe(true);
      const state = readSecondaryRateLimitState(stateFile);
      expect(state).not.toBeNull();
      expect(typeof state?.resetTimeMs).toBe('number');
    });

    it('writes the breaker state file when abuse detection body signals secondary rate limit and isContentCreating is true', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const stateFile = path.join(tmpDir, 'write-abuse-detection-body.json');
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'You have triggered an abuse detection mechanism',
          }),
          { status: 403 },
        ),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        true, // isContentCreating
        stateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(fs.existsSync(stateFile)).toBe(true);
      const state = readSecondaryRateLimitState(stateFile);
      expect(state).not.toBeNull();
      expect(typeof state?.resetTimeMs).toBe('number');
    });

    // --- Primary rate limit unchanged paths ---

    it('retries a primary rate-limit response and resolves with the eventual success', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValueOnce(primaryRateLimitResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );

      expect(response.status).toBe(200);
      expect(request).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('does not retry a genuine permission 403 without rate-limit signals', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Resource not accessible by integration',
          }),
          { status: 403, headers: { 'x-ratelimit-remaining': '4999' } },
        ),
      );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('stops retrying after the bounded retry cap and never blocks past the budget', async () => {
      const sleeps: number[] = [];
      const sleep = jest.fn(async (milliseconds: number) => {
        sleeps.push(milliseconds);
      });
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValue(primaryRateLimitResponse());

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );

      expect(response.status).toBe(403);
      expect(request).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES + 1);
      expect(sleep).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES);
      const totalSlept = sleeps.reduce((sum, value) => sum + value, 0);
      expect(totalSlept).toBeLessThanOrEqual(RATE_LIMIT_TOTAL_BACKOFF_CAP_MS);
    });

    it('preserves the response body for the caller after inspecting it for signals', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValueOnce(primaryRateLimitResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: 'final' }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );
      const body: unknown = await response.json();

      expect(body).toEqual({ value: 'final' });
    });

    it('preserves the response body when returning immediately on a secondary rate limit', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const payload = { message: 'You have exceeded a secondary rate limit' };
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValue(
          new Response(JSON.stringify(payload), { status: 403 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(
        request,
        sleep,
        Date.now,
        false,
        false,
        tmpStateFile,
      );
      const body: unknown = await response.json();

      expect(body).toEqual(payload);
    });
  });
});
