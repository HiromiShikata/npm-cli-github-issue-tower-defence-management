import {
  hasRateLimitSignals,
  computeBoundedBackoffMs,
  computeRateLimitResetIso,
  fetchWithGitHubRateLimitRetry,
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_TOTAL_BACKOFF_CAP_MS,
} from './githubRateLimitRetry';

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
          JSON.stringify({ message: 'You have exceeded a secondary rate limit' }),
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
    const rateLimitResponse = (): Response =>
      new Response(
        JSON.stringify({ message: 'API rate limit exceeded' }),
        { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
      );

    it('retries a rate-limit response and resolves with the eventual success', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest
        .fn<Promise<Response>, []>()
        .mockResolvedValueOnce(rateLimitResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(request, sleep);

      expect(response.status).toBe(200);
      expect(request).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('does not retry a genuine permission 403 without rate-limit signals', async () => {
      const sleep = jest.fn().mockResolvedValue(undefined);
      const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Resource not accessible by integration' }),
          { status: 403, headers: { 'x-ratelimit-remaining': '4999' } },
        ),
      );

      const response = await fetchWithGitHubRateLimitRetry(request, sleep);

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
        .mockResolvedValue(rateLimitResponse());

      const response = await fetchWithGitHubRateLimitRetry(request, sleep);

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
        .mockResolvedValueOnce(rateLimitResponse())
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: 'final' }), { status: 200 }),
        );

      const response = await fetchWithGitHubRateLimitRetry(request, sleep);
      const body: unknown = await response.json();

      expect(body).toEqual({ value: 'final' });
    });
  });
});
