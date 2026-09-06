import {
  REST_RATE_LIMIT_ALWAYS_LOG_THRESHOLD,
  REST_RATE_LIMIT_DROP_THRESHOLD,
  REST_RATE_LIMIT_LOG_INTERVAL_MS,
  createRestRateLimitState,
  extractRestRateLimitHeaders,
  logGithubRestRateLimit,
  sanitizeErrorForLogging,
  sanitizeHeaders,
  shouldLogRestRateLimit,
} from './githubRestClient';

const getFirstConsoleLogArg = (spy: jest.SpyInstance): string => {
  const calls: unknown = spy.mock.calls;
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error('Expected at least one console.log call');
  }
  const firstCall: unknown = calls[0];
  if (!Array.isArray(firstCall) || firstCall.length === 0) {
    throw new Error('Expected at least one argument in first call');
  }
  const arg: unknown = firstCall[0];
  if (typeof arg !== 'string') {
    throw new Error(`Expected string argument, got ${typeof arg}`);
  }
  return arg;
};

const getAllConsoleLogStrings = (spy: jest.SpyInstance): string[] => {
  const calls: unknown = spy.mock.calls;
  if (!Array.isArray(calls)) return [];
  const result: string[] = [];
  for (const call of calls) {
    if (Array.isArray(call) && call.length > 0 && typeof call[0] === 'string') {
      result.push(call[0]);
    }
  }
  return result;
};

describe('extractRestRateLimitHeaders', () => {
  it('returns all nulls when no x-ratelimit-* headers are present', () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    const result = extractRestRateLimitHeaders(headers);
    expect(result.remaining).toBeNull();
    expect(result.limit).toBeNull();
    expect(result.resource).toBeNull();
    expect(result.resetEpochSeconds).toBeNull();
  });

  it('parses all x-ratelimit-* headers into numeric and string values', () => {
    const headers = new Headers({
      'x-ratelimit-remaining': '4321',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-resource': 'core',
      'x-ratelimit-reset': '1788661347',
    });
    const result = extractRestRateLimitHeaders(headers);
    expect(result.remaining).toBe(4321);
    expect(result.limit).toBe(5000);
    expect(result.resource).toBe('core');
    expect(result.resetEpochSeconds).toBe(1788661347);
  });

  it('returns null for a non-numeric remaining header value', () => {
    const headers = new Headers({ 'x-ratelimit-remaining': 'not-a-number' });
    const result = extractRestRateLimitHeaders(headers);
    expect(result.remaining).toBeNull();
  });
});

describe('shouldLogRestRateLimit', () => {
  it('returns true on first call when lastLoggedRemaining is null', () => {
    const state = createRestRateLimitState();
    expect(shouldLogRestRateLimit(1000, state, Date.now())).toBe(true);
  });

  it('returns true when remaining is below the always-log threshold', () => {
    const state = createRestRateLimitState();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = Date.now();
    expect(
      shouldLogRestRateLimit(
        REST_RATE_LIMIT_ALWAYS_LOG_THRESHOLD - 1,
        state,
        Date.now(),
      ),
    ).toBe(true);
  });

  it('returns true when the interval since last log exceeds the threshold', () => {
    const state = createRestRateLimitState();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = Date.now() - REST_RATE_LIMIT_LOG_INTERVAL_MS - 1;
    expect(shouldLogRestRateLimit(999, state, Date.now())).toBe(true);
  });

  it('returns true when remaining drops by the drop threshold since last log', () => {
    const state = createRestRateLimitState();
    const nowMs = Date.now();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = nowMs;
    expect(
      shouldLogRestRateLimit(
        1000 - REST_RATE_LIMIT_DROP_THRESHOLD,
        state,
        nowMs,
      ),
    ).toBe(true);
  });

  it('returns false when remaining is stable and interval has not elapsed', () => {
    const state = createRestRateLimitState();
    const nowMs = Date.now();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = nowMs;
    expect(
      shouldLogRestRateLimit(
        1000 - REST_RATE_LIMIT_DROP_THRESHOLD + 1,
        state,
        nowMs,
      ),
    ).toBe(false);
  });
});

describe('logGithubRestRateLimit', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('does not log when x-ratelimit-remaining is absent', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '5000',
      'x-ratelimit-resource': 'core',
    });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('does not log when throttling suppresses the output', () => {
    const state = createRestRateLimitState();
    const nowMs = Date.now();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = nowMs;
    const headers = new Headers({ 'x-ratelimit-remaining': '999' });
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
      now: () => new Date(nowMs),
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs the correct format including ISO timestamp, path, and rate limit fields', () => {
    const fixedNow = new Date('2026-09-06T01:30:00.000Z');
    const resetEpochSeconds = 1788661347;
    const expectedResetIso = new Date(resetEpochSeconds * 1000).toISOString();
    const headers = new Headers({
      'x-ratelimit-remaining': '4321',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-resource': 'core',
      'x-ratelimit-reset': String(resetEpochSeconds),
    });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100',
      headers,
      state,
      now: () => fixedNow,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `2026-09-06T01:30:00.000Z githubRestClient: path=/repos/owner/repo/issues/1/comments remaining=4321 limit=5000 resource=core reset=${expectedResetIso}`,
    );
  });

  it('strips query string from the URL in the log output', () => {
    const headers = new Headers({ 'x-ratelimit-remaining': '4321' });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues/1/comments?per_page=100&page=2&token=SHOULD_NOT_APPEAR',
      headers,
      state,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('path=/repos/owner/repo/issues/1/comments'),
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('per_page'),
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('SHOULD_NOT_APPEAR'),
    );
  });

  it('logs unknown for limit, resource, and reset when those headers are absent', () => {
    const headers = new Headers({ 'x-ratelimit-remaining': '100' });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('limit=unknown resource=unknown reset=unknown'),
    );
  });

  it('does not include the Authorization header value in the log output', () => {
    const headers = new Headers({
      Authorization: 'Bearer ghp_super_secret_token',
      'x-ratelimit-remaining': '999',
      'x-ratelimit-limit': '1000',
      'x-ratelimit-resource': 'core',
      'x-ratelimit-reset': '1700000000',
    });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
    });
    const loggedStrings = getAllConsoleLogStrings(consoleLogSpy);
    expect(loggedStrings.some((s) => s.includes('ghp_super_secret_token'))).toBe(false);
    expect(loggedStrings.some((s) => s.includes('Bearer'))).toBe(false);
  });

  it('always logs when remaining is below the always-log threshold', () => {
    const state = createRestRateLimitState();
    const nowMs = Date.now();
    state.lastLoggedRemaining = 1000;
    state.lastLoggedAtMs = nowMs;
    const headers = new Headers({
      'x-ratelimit-remaining': String(REST_RATE_LIMIT_ALWAYS_LOG_THRESHOLD - 1),
    });
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
      now: () => new Date(nowMs),
    });
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the state after logging so subsequent stable calls are suppressed', () => {
    const state = createRestRateLimitState();
    const fixedNow = new Date('2026-09-06T01:30:00.000Z');
    const headers = new Headers({ 'x-ratelimit-remaining': '1000' });
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
      now: () => fixedNow,
    });
    expect(state.lastLoggedRemaining).toBe(1000);
    consoleLogSpy.mockClear();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers: new Headers({ 'x-ratelimit-remaining': '999' }),
      state,
      now: () => fixedNow,
    });
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('uses the real clock when now is not provided', () => {
    const before = Date.now();
    const headers = new Headers({ 'x-ratelimit-remaining': '500' });
    const state = createRestRateLimitState();
    logGithubRestRateLimit({
      url: 'https://api.github.com/repos/owner/repo/issues',
      headers,
      state,
    });
    const after = Date.now();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const logLine = getFirstConsoleLogArg(consoleLogSpy);
    const timestampMatch = logLine.match(/^(\S+) githubRestClient:/);
    expect(timestampMatch).not.toBeNull();
    if (timestampMatch !== null) {
      const loggedMs = new Date(timestampMatch[1]).getTime();
      expect(loggedMs).toBeGreaterThanOrEqual(before);
      expect(loggedMs).toBeLessThanOrEqual(after);
    }
  });
});

describe('sanitizeHeaders', () => {
  it('replaces the authorization header value with [REDACTED]', () => {
    const headers = new Headers({ authorization: 'Bearer secret-token-xyz' });
    const sanitized = sanitizeHeaders(headers);
    expect(Object.values(sanitized).includes('[REDACTED]')).toBe(true);
    expect(JSON.stringify(sanitized)).not.toContain('secret-token-xyz');
  });

  it('is case-insensitive for the Authorization header name', () => {
    const headers = new Headers({ Authorization: 'Bearer another-secret' });
    const sanitized = sanitizeHeaders(headers);
    expect(JSON.stringify(sanitized)).not.toContain('another-secret');
    expect(Object.values(sanitized).includes('[REDACTED]')).toBe(true);
  });

  it('replaces the cookie header value with [REDACTED]', () => {
    const headers = new Headers({ cookie: 'session=abc123' });
    const sanitized = sanitizeHeaders(headers);
    expect(JSON.stringify(sanitized)).not.toContain('abc123');
    expect(Object.values(sanitized).includes('[REDACTED]')).toBe(true);
  });

  it('replaces the x-api-key header value with [REDACTED]', () => {
    const headers = new Headers({ 'x-api-key': 'mykey-secret' });
    const sanitized = sanitizeHeaders(headers);
    expect(JSON.stringify(sanitized)).not.toContain('mykey-secret');
    expect(Object.values(sanitized).includes('[REDACTED]')).toBe(true);
  });

  it('preserves non-sensitive header values unchanged', () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    const sanitized = sanitizeHeaders(headers);
    expect(sanitized['content-type']).toBe('application/json');
  });

  it('uses a fixed [REDACTED] marker regardless of the original value length', () => {
    const shortTokenHeaders = new Headers({ authorization: 'Bearer abc' });
    const longTokenHeaders = new Headers({
      authorization: 'Bearer ' + 'x'.repeat(100),
    });
    const sanitizedShort = sanitizeHeaders(shortTokenHeaders);
    const sanitizedLong = sanitizeHeaders(longTokenHeaders);
    expect(sanitizedShort['authorization']).toBe('[REDACTED]');
    expect(sanitizedLong['authorization']).toBe('[REDACTED]');
  });
});

describe('sanitizeErrorForLogging', () => {
  it('returns a non-Error value unchanged', () => {
    const value = { code: 'not-an-error' };
    expect(sanitizeErrorForLogging(value)).toBe(value);
  });

  it('returns a plain Error unchanged when it has no request or response property', () => {
    const error = new Error('plain error');
    expect(sanitizeErrorForLogging(error)).toBe(error);
  });

  it('masks the authorization header in an error with a Request property', () => {
    const request = new Request('https://api.github.com/graphql', {
      headers: { authorization: 'Bearer secret-token-abc123' },
    });
    const error = Object.assign(new Error('HTTP 403'), { request });
    const sanitized = sanitizeErrorForLogging(error);
    const sanitizedStr = JSON.stringify(sanitized);
    expect(sanitizedStr).not.toContain('secret-token-abc123');
    expect(sanitizedStr).toContain('[REDACTED]');
  });

  it('masks the Authorization header (uppercase) case-insensitively', () => {
    const request = new Request('https://api.github.com/graphql', {
      headers: { Authorization: 'Bearer another-secret-value' },
    });
    const error = Object.assign(new Error('HTTP 403'), { request });
    const sanitized = sanitizeErrorForLogging(error);
    const sanitizedStr = JSON.stringify(sanitized);
    expect(sanitizedStr).not.toContain('another-secret-value');
    expect(sanitizedStr).toContain('[REDACTED]');
  });

  it('preserves error name, message, and stack in the sanitized output', () => {
    const request = new Request('https://api.github.com/graphql', {
      headers: { authorization: 'Bearer token' },
    });
    const error = Object.assign(new Error('Something went wrong'), { request });
    const sanitized = sanitizeErrorForLogging(error);
    expect(typeof sanitized).toBe('object');
    if (
      typeof sanitized === 'object' &&
      sanitized !== null &&
      'message' in sanitized &&
      'name' in sanitized
    ) {
      const msg: unknown = sanitized.message;
      const name: unknown = sanitized.name;
      expect(msg).toBe('Something went wrong');
      expect(name).toBe('Error');
    }
  });

  it('strips query strings from the request URL in the sanitized output', () => {
    const request = new Request(
      'https://api.github.com/repos/owner/repo/issues?token=SECRET',
      { headers: { authorization: 'Bearer token' } },
    );
    const error = Object.assign(new Error('HTTP 403'), { request });
    const sanitized = sanitizeErrorForLogging(error);
    const sanitizedStr = JSON.stringify(sanitized);
    expect(sanitizedStr).not.toContain('SECRET');
  });

  it('masks response headers when the error carries a Response property', () => {
    const response = new Response(null, {
      status: 403,
      headers: { 'set-cookie': 'session=topsecret' },
    });
    const error = Object.assign(new Error('HTTP 403'), { response });
    const sanitized = sanitizeErrorForLogging(error);
    const sanitizedStr = JSON.stringify(sanitized);
    expect(sanitizedStr).not.toContain('topsecret');
    expect(sanitizedStr).toContain('[REDACTED]');
  });
});
