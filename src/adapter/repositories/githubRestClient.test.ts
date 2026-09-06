import {
  logGithubRestRateLimit,
  sanitizeRestPath,
  extractRestCallSite,
} from './githubRestClient';

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

  describe('sanitizeRestPath', () => {
    it('returns the pathname of a full GitHub API URL', () => {
      expect(
        sanitizeRestPath(
          'https://api.github.com/repos/owner/repo/issues?per_page=100&page=2',
        ),
      ).toBe('/repos/owner/repo/issues');
    });

    it('returns the full path when there is no query string', () => {
      expect(
        sanitizeRestPath('https://api.github.com/repos/owner/repo/pulls/123'),
      ).toBe('/repos/owner/repo/pulls/123');
    });

    it('strips all query parameters including any that might carry credential values', () => {
      const result = sanitizeRestPath(
        'https://api.github.com/path?access_token=secret&state=open',
      );
      expect(result).not.toContain('secret');
      expect(result).not.toContain('access_token');
      expect(result).toBe('/path');
    });

    it('falls back gracefully for a relative path without a query string', () => {
      expect(sanitizeRestPath('/repos/owner/repo/issues')).toBe(
        '/repos/owner/repo/issues',
      );
    });

    it('strips query string from a relative path', () => {
      expect(sanitizeRestPath('/repos/owner/repo/issues?per_page=100')).toBe(
        '/repos/owner/repo/issues',
      );
    });
  });

  describe('extractRestCallSite', () => {
    it('returns the nearest non-infrastructure module names from a stack', () => {
      const stack = [
        'Error',
        '    at captureRestCallSite (/app/bin/adapter/repositories/githubRestClient.js:80:20)',
        '    at fetchWithGitHubRateLimitRetry (/app/bin/adapter/repositories/issue/githubRateLimitRetry.js:120:22)',
        '    at ApiV3CheerioRestIssueRepository.fetchBranch (/app/bin/adapter/repositories/issue/ApiV3CheerioRestIssueRepository.js:500:11)',
        '    at async StartPreparationUseCase.run (/app/bin/domain/usecases/StartPreparationUseCase.js:63:31)',
      ].join('\n');

      const result = extractRestCallSite(stack);

      expect(result).toContain('ApiV3CheerioRestIssueRepository');
      expect(result).not.toContain('githubRestClient');
      expect(result).not.toContain('githubRateLimitRetry');
    });

    it('returns unknown for an empty stack', () => {
      expect(extractRestCallSite(undefined)).toBe('unknown');
      expect(extractRestCallSite('')).toBe('unknown');
    });

    it('deduplicates consecutive frames from the same module', () => {
      const stack = [
        'Error',
        '    at captureRestCallSite (/app/bin/adapter/repositories/githubRestClient.js:80:20)',
        '    at ApiV3CheerioRestIssueRepository.methodA (/app/bin/adapter/repositories/issue/ApiV3CheerioRestIssueRepository.js:100:5)',
        '    at ApiV3CheerioRestIssueRepository.methodB (/app/bin/adapter/repositories/issue/ApiV3CheerioRestIssueRepository.js:200:5)',
        '    at SomeUseCase.run (/app/bin/domain/usecases/SomeUseCase.js:50:5)',
      ].join('\n');

      const result = extractRestCallSite(stack);

      expect(result).toBe('ApiV3CheerioRestIssueRepository<-SomeUseCase');
    });
  });

  describe('logGithubRestRateLimit', () => {
    it('returns without logging when headers are empty (no x-ratelimit-remaining)', () => {
      logGithubRestRateLimit({
        headers: new Headers(),
        method: 'GET',
        path: '/test',
        caller: 'TestCaller',
      });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('returns without logging when x-ratelimit-remaining is absent', () => {
      const headers = new Headers({
        'x-ratelimit-used': '100',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': '1700000000',
      });
      logGithubRestRateLimit({
        headers,
        method: 'GET',
        path: '/repos/owner/repo/issues',
        caller: 'TestCaller',
      });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('logs method, path, resource, used, remaining, limit, reset, and caller when all headers are present', () => {
      const fixedNow = new Date('2026-09-06T02:00:00.000Z');
      const headers = new Headers({
        'x-ratelimit-used': '42',
        'x-ratelimit-remaining': '4958',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-reset': '1700000000',
      });
      const expectedResetIso = new Date(1700000000 * 1000).toISOString();

      logGithubRestRateLimit({
        headers,
        method: 'GET',
        path: '/repos/owner/repo/issues',
        caller: 'ApiV3CheerioRestIssueRepository',
        now: () => fixedNow,
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `2026-09-06T02:00:00.000Z githubRestClient: method=GET path=/repos/owner/repo/issues resource=core used=42 remaining=4958 limit=5000 reset=${expectedResetIso} caller=ApiV3CheerioRestIssueRepository`,
      );
    });

    it('logs with null fields when only x-ratelimit-remaining is present', () => {
      const fixedNow = new Date('2026-09-06T02:00:00.000Z');
      const headers = new Headers({ 'x-ratelimit-remaining': '100' });

      logGithubRestRateLimit({
        headers,
        method: 'POST',
        path: '/repos/owner/repo/issues/1/comments',
        caller: 'GitHubIssueCommentRepository',
        now: () => fixedNow,
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '2026-09-06T02:00:00.000Z githubRestClient: method=POST path=/repos/owner/repo/issues/1/comments resource=null used=null remaining=100 limit=null reset=null caller=GitHubIssueCommentRepository',
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

      logGithubRestRateLimit({
        headers,
        method: 'GET',
        path: '/repos/owner/repo',
        caller: 'TestCaller',
        now: () => fixedNow,
      });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logLine = getFirstConsoleLogArg(consoleLogSpy);
      expect(logLine).not.toContain('ghp_super_secret_token');
      expect(logLine).not.toContain('Bearer');
      expect(logLine).not.toContain('Authorization');
    });

    it('uses real clock when now is not provided', () => {
      const before = Date.now();
      const headers = new Headers({ 'x-ratelimit-remaining': '500' });

      logGithubRestRateLimit({
        headers,
        method: 'GET',
        path: '/repos/owner/repo',
        caller: 'TestCaller',
      });

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
