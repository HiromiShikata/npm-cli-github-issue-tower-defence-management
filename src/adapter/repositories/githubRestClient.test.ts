import { logGithubRestRateLimit } from './githubRestClient';

const getFirstConsoleLogArg = (spy: jest.SpyInstance): string => {
  const calls: unknown = spy.mock.calls;
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error('Expected at least one console.log call');
  }
  const firstCall: unknown = calls[0];
  if (!Array.isArray(firstCall) || firstCall.length === 0) {
    throw new Error('Expected first call to have arguments');
  }
  const arg: unknown = firstCall[0];
  if (typeof arg !== 'string') {
    throw new Error(`Expected string argument, got ${typeof arg}`);
  }
  return arg;
};

describe('githubRestClient', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('logGithubRestRateLimit', () => {
    it('returns without logging when headers are empty (no x-ratelimit-remaining)', () => {
      logGithubRestRateLimit({ headers: new Headers() });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('returns without logging when x-ratelimit-remaining is absent', () => {
      const headers = new Headers({
        'x-ratelimit-used': '100',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': '1700000000',
      });
      logGithubRestRateLimit({ headers });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('logs all fields when all x-ratelimit-* headers are present', () => {
      const fixedNow = new Date('2026-09-06T02:00:00.000Z');
      const headers = new Headers({
        'x-ratelimit-used': '42',
        'x-ratelimit-remaining': '4958',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': '1700000000',
      });
      const expectedResetIso = new Date(1700000000 * 1000).toISOString();

      logGithubRestRateLimit({ headers, now: () => fixedNow });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `2026-09-06T02:00:00.000Z githubRestClient: resource=core used=42 remaining=4958 limit=5000 reset=${expectedResetIso}`,
      );
    });

    it('logs with null fields when only x-ratelimit-remaining is present', () => {
      const fixedNow = new Date('2026-09-06T02:00:00.000Z');
      const headers = new Headers({ 'x-ratelimit-remaining': '100' });

      logGithubRestRateLimit({ headers, now: () => fixedNow });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '2026-09-06T02:00:00.000Z githubRestClient: resource=null used=null remaining=100 limit=null reset=null',
      );
    });

    it('does not output the Authorization header value', () => {
      const fixedNow = new Date('2026-09-06T02:00:00.000Z');
      const headers = new Headers({
        Authorization: 'Bearer ghp_super_secret_token',
        'x-ratelimit-remaining': '999',
        'x-ratelimit-used': '1',
        'x-ratelimit-limit': '1000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': '1700000000',
      });

      logGithubRestRateLimit({ headers, now: () => fixedNow });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logLine = getFirstConsoleLogArg(consoleLogSpy);
      expect(logLine).not.toContain('ghp_super_secret_token');
      expect(logLine).not.toContain('Bearer');
      expect(logLine).not.toContain('Authorization');
    });

    it('uses real clock when now is not provided', () => {
      const before = Date.now();
      const headers = new Headers({ 'x-ratelimit-remaining': '500' });

      logGithubRestRateLimit({ headers });

      const after = Date.now();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logLine = getFirstConsoleLogArg(consoleLogSpy);
      const timestampMatch = logLine.match(/^(\S+) githubRestClient:/);
      expect(timestampMatch).not.toBeNull();
      if (timestampMatch === null) {
        throw new Error('Expected timestampMatch to not be null');
      }
      const loggedMs = new Date(timestampMatch[1]).getTime();
      expect(loggedMs).toBeGreaterThanOrEqual(before);
      expect(loggedMs).toBeLessThanOrEqual(after);
    });
  });
});
