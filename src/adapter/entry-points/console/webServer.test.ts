import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import { parseAllDocuments } from 'yaml';
import {
  DEFAULT_WEB_PORT,
  CONSOLE_TOKEN_HEADER,
  CONSOLE_TOKEN_COOKIE,
  hasDotSegment,
  requiresToken,
  isTokenValid,
  isConsoleAppRoute,
  extractProvidedToken,
  extractCookieToken,
  isOwnerCallFileRequestPath,
  resolveFlatInTmuxFilePath,
  resolveDashboardFilePath,
  startWebServer,
} from './webServer';
import type { ImageFetcher } from './consoleImageProxy';
import { IssueTitleStateCache, PullRequestStatusCache } from './consoleReadApi';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import { readDoneProjectItemIds } from './consoleDoneStore';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ownerCallFileRelativePath } from '../../../domain/usecases/intmux/OwnerCallFile';
import { toTmuxSessionName } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { ownerCallFileAppend } from '../handlers/ownerCallFileStore';

describe('webServer pure helpers', () => {
  describe('DEFAULT_WEB_PORT', () => {
    it('is 9980', () => {
      expect(DEFAULT_WEB_PORT).toBe(9980);
    });
  });

  describe('hasDotSegment', () => {
    it('returns true for a top-level dot segment', () => {
      expect(hasDotSegment('/.git')).toBe(true);
      expect(hasDotSegment('/.env')).toBe(true);
    });

    it('returns true for a nested dot segment', () => {
      expect(hasDotSegment('/foo/.bar')).toBe(true);
      expect(hasDotSegment('/a/b/.hidden/c')).toBe(true);
    });

    it('returns false for paths without dot segments', () => {
      expect(hasDotSegment('/')).toBe(false);
      expect(hasDotSegment('/index.html')).toBe(false);
      expect(hasDotSegment('/assets/app.js')).toBe(false);
      expect(hasDotSegment('/api/itembody')).toBe(false);
    });
  });

  describe('requiresToken', () => {
    it('requires a token for .json paths', () => {
      expect(requiresToken('/data/situation.json')).toBe(true);
    });

    it('requires a token for /api/* paths', () => {
      expect(requiresToken('/api/review')).toBe(true);
      expect(requiresToken('/api')).toBe(true);
    });

    it('does not require a token for bootstrap assets', () => {
      expect(requiresToken('/')).toBe(false);
      expect(requiresToken('/index.html')).toBe(false);
      expect(requiresToken('/assets/app.js')).toBe(false);
    });
  });

  describe('isConsoleAppRoute', () => {
    it('matches a per-project root route', () => {
      expect(isConsoleAppRoute('/projects/acme')).toBe(true);
      expect(isConsoleAppRoute('/projects/acme/')).toBe(true);
    });

    it('matches a per-project tab route for every list tab', () => {
      expect(isConsoleAppRoute('/projects/acme/workflow-blocker')).toBe(true);
      expect(isConsoleAppRoute('/projects/acme/prs')).toBe(true);
      expect(isConsoleAppRoute('/projects/globex/todo-by-agent')).toBe(true);
      expect(isConsoleAppRoute('/projects/initech/todo-by-human')).toBe(true);
      expect(isConsoleAppRoute('/projects/umbrella/failed-preparation')).toBe(
        true,
      );
      expect(isConsoleAppRoute('/projects/umbrella/todo-by-human')).toBe(true);
      expect(isConsoleAppRoute('/projects/umbrella/todo-by-agent')).toBe(true);
    });

    it('does not match data, api, or unknown tab routes', () => {
      expect(isConsoleAppRoute('/projects/acme/prs/list.json')).toBe(false);
      expect(isConsoleAppRoute('/projects/acme/unknown')).toBe(false);
      expect(isConsoleAppRoute('/projects')).toBe(false);
      expect(isConsoleAppRoute('/api/review')).toBe(false);
      expect(isConsoleAppRoute('/')).toBe(false);
    });

    it('does not match a dot-prefixed pjcode', () => {
      expect(isConsoleAppRoute('/projects/.git')).toBe(false);
    });
  });

  describe('isTokenValid', () => {
    it('accepts a matching token', () => {
      expect(isTokenValid('expected', 'expected')).toBe(true);
    });

    it('rejects a missing or mismatched token', () => {
      expect(isTokenValid('expected', null)).toBe(false);
      expect(isTokenValid('expected', 'other')).toBe(false);
      expect(isTokenValid('expected', '')).toBe(false);
    });
  });

  describe('extractProvidedToken', () => {
    it('prefers the query token', () => {
      expect(
        extractProvidedToken('fromQuery', 'fromHeader', 'fromCookie'),
      ).toBe('fromQuery');
    });

    it('falls back to the header token before the cookie token', () => {
      expect(extractProvidedToken(null, 'fromHeader', 'fromCookie')).toBe(
        'fromHeader',
      );
    });

    it('falls back to the cookie token when query and header are absent', () => {
      expect(extractProvidedToken(null, undefined, 'fromCookie')).toBe(
        'fromCookie',
      );
    });

    it('returns null when none is present', () => {
      expect(extractProvidedToken(null, undefined, null)).toBeNull();
      expect(extractProvidedToken('', undefined, '')).toBeNull();
    });
  });

  describe('extractCookieToken', () => {
    it('reads the token cookie value from a cookie header', () => {
      expect(extractCookieToken(`${CONSOLE_TOKEN_COOKIE}=cookie-value`)).toBe(
        'cookie-value',
      );
    });

    it('reads the token cookie when other cookies are present', () => {
      expect(
        extractCookieToken(
          `other=1; ${CONSOLE_TOKEN_COOKIE}=cookie-value; a=b`,
        ),
      ).toBe('cookie-value');
    });

    it('decodes a percent-encoded cookie value', () => {
      expect(extractCookieToken(`${CONSOLE_TOKEN_COOKIE}=a%20b`)).toBe('a b');
    });

    it('returns null when the token cookie is absent, empty, or undefined', () => {
      expect(extractCookieToken('other=1')).toBeNull();
      expect(extractCookieToken(`${CONSOLE_TOKEN_COOKIE}=`)).toBeNull();
      expect(extractCookieToken(undefined)).toBeNull();
      expect(extractCookieToken('')).toBeNull();
    });
  });
});

describe('webServer integration', () => {
  const testToken = 'integration-test-token-value';

  const requestServer = (
    server: http.Server,
    requestPath: string,
    headers: http.OutgoingHttpHeaders = {},
  ): Promise<{
    statusCode: number;
    body: string;
    cacheControl: string | undefined;
    contentType: string | undefined;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path: requestPath, headers },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
              cacheControl: response.headers['cache-control'],
              contentType: response.headers['content-type'],
            });
          });
        },
      );
      request.on('error', reject);
      request.end();
    });
  };

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  it('starts on an ephemeral port and closes gracefully', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    const address = server.address();
    expect(address).not.toBeNull();
    expect(typeof address).not.toBe('string');
    await closeServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves the placeholder index without a token when ui-dist is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const root = await requestServer(server, '/');
      expect(root.statusCode).toBe(200);
      expect(root.body).toContain('TDPM Console');
      expect(root.cacheControl).toBe('no-store');
      expect(root.contentType).toContain('text/html');

      const indexHtml = await requestServer(server, '/index.html');
      expect(indexHtml.statusCode).toBe(200);
      expect(indexHtml.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for a missing non-index file when ui-dist is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const missing = await requestServer(server, '/assets/app.js');
      expect(missing.statusCode).toBe(404);
      expect(missing.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves built bootstrap assets without a token', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const uiDistDir = path.join(tmpDir, 'ui-dist');
    fs.mkdirSync(path.join(uiDistDir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(uiDistDir, 'index.html'),
      '<!DOCTYPE html><title>built</title>',
    );
    fs.writeFileSync(
      path.join(uiDistDir, 'assets', 'app.js'),
      'console.log("app");',
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const index = await requestServer(server, '/');
      expect(index.statusCode).toBe(200);
      expect(index.body).toContain('built');

      const appJs = await requestServer(server, '/assets/app.js');
      expect(appJs.statusCode).toBe(200);
      expect(appJs.body).toContain('app');
      expect(appJs.contentType).toContain('text/javascript');
      expect(appJs.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves the SPA index for per-project app routes without a token', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const uiDistDir = path.join(tmpDir, 'ui-dist');
    fs.mkdirSync(uiDistDir, { recursive: true });
    fs.writeFileSync(
      path.join(uiDistDir, 'index.html'),
      '<!DOCTYPE html><title>spa</title><div id="root"></div>',
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const projectRoot = await requestServer(server, '/projects/acme');
      expect(projectRoot.statusCode).toBe(200);
      expect(projectRoot.body).toContain('spa');
      expect(projectRoot.contentType).toContain('text/html');
      expect(projectRoot.cacheControl).toBe('no-store');

      const projectTab = await requestServer(server, '/projects/globex/prs');
      expect(projectTab.statusCode).toBe(200);
      expect(projectTab.body).toContain('spa');

      const unknownTab = await requestServer(
        server,
        '/projects/globex/unknown',
      );
      expect(unknownTab.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves the placeholder index for per-project routes when ui-dist is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const projectRoot = await requestServer(server, '/projects/acme/prs');
      expect(projectRoot.statusCode).toBe(200);
      expect(projectRoot.body).toContain('TDPM Console');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects dot-prefixed paths with 404', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const uiDistDir = path.join(tmpDir, 'ui-dist');
    fs.mkdirSync(uiDistDir, { recursive: true });
    fs.writeFileSync(path.join(uiDistDir, '.env'), 'SECRET=should-not-serve');
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const dotEnv = await requestServer(server, '/.env');
      expect(dotEnv.statusCode).toBe(404);
      expect(dotEnv.body).not.toContain('SECRET');

      const dotGit = await requestServer(server, '/.git/config');
      expect(dotGit.statusCode).toBe(404);

      const nestedDot = await requestServer(server, '/foo/.bar');
      expect(nestedDot.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects .json and /api/* without a token and passes the gate with a valid token', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const jsonNoToken = await requestServer(server, '/data/situation.json');
      expect(jsonNoToken.statusCode).toBe(401);
      expect(jsonNoToken.cacheControl).toBe('no-store');

      const apiNoToken = await requestServer(server, '/api/review');
      expect(apiNoToken.statusCode).toBe(401);

      const jsonWithQueryToken = await requestServer(
        server,
        `/data/situation.json?k=${testToken}`,
      );
      expect(jsonWithQueryToken.statusCode).toBe(404);

      const apiWithQueryToken = await requestServer(
        server,
        `/api/review?k=${testToken}`,
      );
      expect(apiWithQueryToken.statusCode).toBe(404);

      const apiWithHeaderToken = await requestServer(server, '/api/review', {
        [CONSOLE_TOKEN_HEADER]: testToken,
      });
      expect(apiWithHeaderToken.statusCode).toBe(404);

      const apiWithWrongToken = await requestServer(
        server,
        '/api/review?k=wrong-token',
      );
      expect(apiWithWrongToken.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('webServer new routes integration', () => {
  const testToken = 'integration-test-token-value';

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const request = (
    server: http.Server,
    method: string,
    requestPath: string,
    body?: unknown,
  ): Promise<{ statusCode: number; body: string }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        {
          host: '127.0.0.1',
          port,
          path: requestPath,
          method,
          headers:
            payload === null
              ? {}
              : {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(payload),
                },
        },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
            });
          });
        },
      );
      httpRequest.on('error', reject);
      if (payload !== null) {
        httpRequest.write(payload);
      }
      httpRequest.end();
    });
  };

  const buildProject = (): Project => ({
    ...mock<Project>(),
    id: 'PVT_1',
    status: {
      name: 'Status',
      fieldId: 'statusField',
      statuses: [
        {
          id: 'status_aw',
          name: 'Awaiting workspace',
          color: 'GRAY',
          description: '',
        },
      ],
    },
  });

  it('serves a data list file through the token gate without done filtering', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const dataDir = path.join(tmpDir, 'data');
    const listDir = path.join(dataDir, 'acme', 'prs');
    fs.mkdirSync(listDir, { recursive: true });
    fs.writeFileSync(
      path.join(listDir, 'list.json'),
      JSON.stringify({
        pjcode: 'acme',
        items: [
          { projectItemId: 'PVTI_keep' },
          { projectItemId: 'PVTI_also_keep' },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(listDir, '.done.json'),
      JSON.stringify({ projectItemIds: ['PVTI_also_keep'] }),
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: dataDir,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const unauthorized = await request(
        server,
        'GET',
        '/projects/acme/prs/list.json',
      );
      expect(unauthorized.statusCode).toBe(401);

      const authorized = await request(
        server,
        'GET',
        `/projects/acme/prs/list.json?k=${testToken}`,
      );
      expect(authorized.statusCode).toBe(200);
      const parsed: unknown = JSON.parse(authorized.body);
      expect(parsed).toEqual({
        pjcode: 'acme',
        items: [
          { projectItemId: 'PVTI_keep' },
          { projectItemId: 'PVTI_also_keep' },
        ],
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves a read api response when an issue repository is injected', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body text');
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      issueTitleStateCache: new IssueTitleStateCache(),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/itembody?k=${testToken}&url=https://github.com/o/r/issues/1`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ body: 'body text' });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reads through the issue repository resolved from the requested url', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const defaultIssueRepository = mock<IssueRepository>();
    defaultIssueRepository.getIssueOrPullRequestBody.mockResolvedValue(
      'default token body',
    );
    const ownerIssueRepository = mock<IssueRepository>();
    ownerIssueRepository.getIssueOrPullRequestBody.mockResolvedValue(
      'owner token body',
    );
    const resolvedUrls: string[] = [];
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository: defaultIssueRepository,
      resolveIssueRepository: (issueOrPullRequestUrl: string) => {
        resolvedUrls.push(issueOrPullRequestUrl);
        return ownerIssueRepository;
      },
      issueTitleStateCache: new IssueTitleStateCache(),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/itembody?k=${testToken}&url=https://github.com/acme-labs/acme-portal-mock/issues/178`,
      );
      expect(JSON.parse(response.body)).toEqual({ body: 'owner token body' });
      expect(resolvedUrls).toEqual([
        'https://github.com/acme-labs/acme-portal-mock/issues/178',
      ]);
      expect(
        defaultIssueRepository.getIssueOrPullRequestBody,
      ).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 429 with the rate limit error message instead of 500 when the repository throws a GitHub rate limit error', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    const rateLimitMessage =
      'Failed to fetch body for https://github.com/o/r/issues/1: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at 2026-01-01T01:00:00.000Z)';
    issueRepository.getIssueOrPullRequestBody.mockRejectedValue(
      new GitHubRateLimitError(rateLimitMessage),
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      issueTitleStateCache: new IssueTitleStateCache(),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/itembody?k=${testToken}&url=https://github.com/o/r/issues/1`,
      );
      expect(response.statusCode).toBe(429);
      expect(JSON.parse(response.body)).toEqual({ error: rateLimitMessage });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves the pull request status read api when a status cache is injected', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue({
      url: 'https://github.com/o/r/pull/1',
      isConflicted: true,
      mergeable: 'CONFLICTING',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: true,
      missingRequiredCheckNames: ['build'],
    });
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      issueTitleStateCache: new IssueTitleStateCache(),
      pullRequestStatusCache: new PullRequestStatusCache(),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/pullrequeststatus?k=${testToken}&url=https://github.com/o/r/pull/1`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        found: true,
        status: {
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build'],
        },
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('posts a comment through the comment operation api', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.createCommentByUrl.mockResolvedValue({
      author: 'HiromiShikata',
      body: 'Thanks, this resolves the parity gap.',
      createdAt: new Date('2026-06-18T03:21:00.000Z'),
    });
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: buildProject() } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/comment?k=${testToken}`,
        {
          pjcode: 'acme',
          url: 'https://github.com/o/r/issues/1',
          body: 'Thanks, this resolves the parity gap.',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'Thanks, this resolves the parity gap.',
      );
      expect(
        issueRepository.getIssueOrPullRequestComments,
      ).not.toHaveBeenCalled();
      expect(JSON.parse(response.body)).toEqual({
        ok: true,
        comment: {
          author: 'HiromiShikata',
          body: 'Thanks, this resolves the parity gap.',
          createdAt: '2026-06-18T03:21:00.000Z',
        },
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('runs an operation api and records the done exclusion', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const dataDir = path.join(tmpDir, 'data');
    const issueRepository = mock<IssueRepository>();
    issueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      itemId: 'PVTI_loaded',
    });
    issueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/o/r/pull/1',
      branchName: null,
      createdAt: new Date(0),
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Test PR',
      state: 'open',
      merged: false,
      isDraft: false,
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      headRefName: 'feature',
      baseRefName: 'main',
      author: 'other-user',
      files: [],
    });
    issueRepository.getAuthenticatedUserLogin.mockResolvedValue(
      'authenticated-user',
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: dataDir,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: buildProject() } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/review?k=${testToken}`,
        {
          pjcode: 'acme',
          action: 'approve_and_merge',
          prUrl: 'https://github.com/o/r/pull/1',
          projectItemId: 'PVTI_op',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(issueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(issueRepository.mergePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(readDoneProjectItemIds(dataDir, 'acme', 'prs')).toContain(
        'PVTI_op',
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('merges the pull request and returns 200 when approvePullRequest returns HTTP 422', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      itemId: 'PVTI_loaded',
    });
    issueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/o/r/pull/1',
      branchName: null,
      createdAt: new Date(0),
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    issueRepository.getPullRequestDetail.mockResolvedValue(null);
    issueRepository.getAuthenticatedUserLogin.mockResolvedValue(
      'authenticated-user',
    );
    issueRepository.approvePullRequest.mockRejectedValue(
      new Error(
        'Failed to approve PR https://github.com/o/r/pull/1: HTTP 422 Review Can not approve your own pull request',
      ),
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: buildProject() } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/review?k=${testToken}`,
        {
          pjcode: 'acme',
          action: 'approve_and_merge',
          prUrl: 'https://github.com/o/r/pull/1',
          projectItemId: 'PVTI_op',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(issueRepository.mergePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 502 with the underlying error message when an operation rejects', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      itemId: 'PVTI_loaded',
    });
    issueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/o/r/pull/1',
      branchName: null,
      createdAt: new Date(0),
      isDraft: false,
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Test PR',
      state: 'open',
      merged: false,
      isDraft: false,
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      headRefName: 'feature',
      baseRefName: 'main',
      author: 'other-user',
      files: [],
    });
    issueRepository.getAuthenticatedUserLogin.mockResolvedValue(
      'authenticated-user',
    );
    issueRepository.mergePullRequest.mockRejectedValue(
      new Error('Failed to merge PR https://github.com/o/r/pull/1: HTTP 405'),
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: buildProject() } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/review?k=${testToken}`,
        {
          pjcode: 'acme',
          action: 'approve_and_merge',
          prUrl: 'https://github.com/o/r/pull/1',
          projectItemId: 'PVTI_op',
        },
      );
      expect(response.statusCode).toBe(502);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Failed to merge PR https://github.com/o/r/pull/1: HTTP 405',
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects an operation api with a malformed json body', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: buildProject() } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      port: 0,
    });
    try {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('server is not listening on a TCP port');
      }
      const malformed = await new Promise<{ statusCode: number }>(
        (resolve, reject) => {
          const payload = '{ not json';
          const httpRequest = http.request(
            {
              host: '127.0.0.1',
              port: address.port,
              path: `/api/review?k=${testToken}`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              },
            },
            (response) => {
              response.on('data', () => undefined);
              response.on('end', () =>
                resolve({ statusCode: response.statusCode ?? 0 }),
              );
            },
          );
          httpRequest.on('error', reject);
          httpRequest.write(payload);
          httpRequest.end();
        },
      );
      expect(malformed.statusCode).toBe(400);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for a read api when no repository is injected', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/itembody?k=${testToken}&url=https://github.com/o/r/issues/1`,
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('routes POST /api/addstory to handleStoryAdd and calls updateStoryList', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const updateStoryList = jest.fn().mockResolvedValue([]);
    const projectWithStory: Project = {
      ...mock<Project>(),
      id: 'PVT_1',
      url: 'https://github.com/orgs/acme-labs/projects/1',
      status: {
        name: 'Status',
        fieldId: 'statusField',
        statuses: [
          {
            id: 'status_aw',
            name: 'Awaiting workspace',
            color: 'GRAY',
            description: '',
          },
        ],
      },
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_blue',
            name: 'Existing story',
            color: 'BLUE',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    };
    const issueRepository = mock<IssueRepository>();
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: projectWithStory } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      resolveProjectRepository: () => ({ updateStoryList }),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/addstory?k=${testToken}`,
        { pjcode: 'acme', storyName: 'My new story' },
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
      expect(updateStoryList).toHaveBeenCalledWith(projectWithStory, [
        {
          id: 'opt_blue',
          name: 'Existing story',
          color: 'BLUE',
          description: '',
        },
        { id: null, name: 'My new story', color: 'RED', description: '' },
      ]);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('routes POST /api/reorderstory to handleReorderStory and calls resolveProjectRepository.updateStoryList', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const updateStoryList = jest.fn().mockResolvedValue([]);
    const projectWithTwoStories: Project = {
      ...mock<Project>(),
      id: 'PVT_1',
      url: 'https://github.com/orgs/acme-labs/projects/1',
      status: {
        name: 'Status',
        fieldId: 'statusField',
        statuses: [
          {
            id: 'status_aw',
            name: 'Awaiting workspace',
            color: 'GRAY',
            description: '',
          },
        ],
      },
      story: {
        name: 'Story',
        fieldId: 'storyField',
        databaseId: 1,
        stories: [
          {
            id: 'opt_first',
            name: 'First story',
            color: 'BLUE',
            description: '',
          },
          {
            id: 'opt_second',
            name: 'Second story',
            color: 'GREEN',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms', name: 'workflow' },
      },
    };
    const issueRepository = mock<IssueRepository>();
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'acme' ? { pjcode, project: projectWithTwoStories } : null,
      isPjcodeConfigured: (pjcode) => pjcode === 'acme',
      resolveProjectRepository: () => ({ updateStoryList }),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/reorderstory?k=${testToken}`,
        { pjcode: 'acme', storyOptionId: 'opt_first', direction: 'down' },
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
      expect(updateStoryList).toHaveBeenCalledWith(projectWithTwoStories, [
        {
          id: 'opt_second',
          name: 'Second story',
          color: 'GREEN',
          description: '',
        },
        {
          id: 'opt_first',
          name: 'First story',
          color: 'BLUE',
          description: '',
        },
      ]);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('resolveFlatInTmuxFilePath', () => {
  const baseDir = path.join(os.tmpdir(), 'in-tmux-data');

  it('resolves a flat .json file under the in-tmux data dir', () => {
    const resolved = resolveFlatInTmuxFilePath(
      baseDir,
      '/in-tmux-by-human/index.v4.json',
    );
    expect(resolved).toBe(path.join(path.resolve(baseDir), 'index.v4.json'));
  });

  it('returns null for paths outside the flat in-tmux prefix', () => {
    expect(resolveFlatInTmuxFilePath(baseDir, '/index.v4.json')).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/projects/acme/in-tmux-by-human/x'),
    ).toBeNull();
  });

  it('returns null for non-json or nested file names', () => {
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/index.txt'),
    ).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/sub/index.json'),
    ).toBeNull();
    expect(resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/')).toBeNull();
  });

  it('returns null for path traversal attempts', () => {
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/../secret.json'),
    ).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/..%2fsecret.json'),
    ).toBeNull();
  });

  it('resolves an owner call file that sits one directory deep', () => {
    expect(
      resolveFlatInTmuxFilePath(
        baseDir,
        '/in-tmux-by-human/call-to-user/umino/secretary.yaml',
      ),
    ).toBe(
      path.join(
        path.resolve(baseDir),
        'call-to-user',
        'umino',
        'secretary.yaml',
      ),
    );
  });

  it('returns null for a yaml file outside the owner call directory shape', () => {
    expect(
      resolveFlatInTmuxFilePath(baseDir, '/in-tmux-by-human/secretary.yaml'),
    ).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(
        baseDir,
        '/in-tmux-by-human/other-directory/umino/secretary.yaml',
      ),
    ).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(
        baseDir,
        '/in-tmux-by-human/call-to-user/umino/nested/secretary.yaml',
      ),
    ).toBeNull();
    expect(
      resolveFlatInTmuxFilePath(
        baseDir,
        '/in-tmux-by-human/call-to-user/umino/secretary.json',
      ),
    ).toBeNull();
  });
});

describe('resolveDashboardFilePath', () => {
  const baseDir = path.join(os.tmpdir(), 'dashboard-static');

  it('resolves /tdpm.txt under the dashboard dir', () => {
    expect(resolveDashboardFilePath(baseDir, '/tdpm.txt')).toBe(
      path.join(path.resolve(baseDir), 'tdpm.txt'),
    );
  });

  it('returns null for any other path', () => {
    expect(resolveDashboardFilePath(baseDir, '/tdpm.html')).toBeNull();
    expect(resolveDashboardFilePath(baseDir, '/other.txt')).toBeNull();
    expect(resolveDashboardFilePath(baseDir, '/')).toBeNull();
    expect(resolveDashboardFilePath(baseDir, '/sub/tdpm.txt')).toBeNull();
  });
});

describe('webServer flat in-tmux-by-human route integration', () => {
  const testToken = 'integration-test-token-value';

  const requestServer = (
    server: http.Server,
    requestPath: string,
    headers: http.OutgoingHttpHeaders = {},
  ): Promise<{
    statusCode: number;
    body: string;
    cacheControl: string | undefined;
    contentType: string | undefined;
    contentLength: string | undefined;
    transferEncoding: string | undefined;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        { host: '127.0.0.1', port, path: requestPath, headers },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
              cacheControl: response.headers['cache-control'],
              contentType: response.headers['content-type'],
              contentLength: response.headers['content-length'],
              transferEncoding: response.headers['transfer-encoding'],
            });
          });
        },
      );
      httpRequest.on('error', reject);
      httpRequest.end();
    });
  };

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const indexV4Raw =
    '{"version":4,"projects":[{"name":"acme","path":"/in-tmux-by-human/acme.v4.json?k=secret"}]}\n';
  const indexV3Raw = '{"version":3,"projects":["acme"]}\n';

  const startWithFixture = async (): Promise<{
    server: http.Server;
    tmpDir: string;
    inTmuxDataDir: string;
  }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const inTmuxDataDir = path.join(tmpDir, 'in-tmux-by-human');
    fs.mkdirSync(inTmuxDataDir, { recursive: true });
    fs.writeFileSync(path.join(inTmuxDataDir, 'index.v4.json'), indexV4Raw);
    fs.writeFileSync(path.join(inTmuxDataDir, 'index.v3.json'), indexV3Raw);
    fs.writeFileSync(path.join(tmpDir, 'secret.json'), '{"secret":true}');
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    return { server, tmpDir, inTmuxDataDir };
  };

  it('serves the flat index.v4.json byte-for-byte with a valid token', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const response = await requestServer(
        server,
        `/in-tmux-by-human/index.v4.json?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(indexV4Raw);
      expect(response.contentType).toContain('application/json');
      expect(response.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('sends an explicit Content-Length and no chunked encoding for the flat index.v4.json', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const response = await requestServer(
        server,
        `/in-tmux-by-human/index.v4.json?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(response.contentLength).toBe(
        String(Buffer.byteLength(indexV4Raw)),
      );
      expect(response.transferEncoding).toBeUndefined();
      expect(response.body).toBe(indexV4Raw);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects the flat route without a token', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const response = await requestServer(
        server,
        '/in-tmux-by-human/index.v4.json',
      );
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves a v3 file for backward compatibility', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const response = await requestServer(
        server,
        `/in-tmux-by-human/index.v3.json?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(indexV3Raw);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal attempts with 404 and does not disclose files', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const traversal = await requestServer(
        server,
        `/in-tmux-by-human/../secret.json?k=${testToken}`,
      );
      expect(traversal.statusCode).toBe(404);
      expect(traversal.body).not.toContain('secret');

      const encodedTraversal = await requestServer(
        server,
        `/in-tmux-by-human/..%2fsecret.json?k=${testToken}`,
      );
      expect(encodedTraversal.statusCode).toBe(404);
      expect(encodedTraversal.body).not.toContain('secret');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for a non-existent flat file', async () => {
    const { server, tmpDir } = await startWithFixture();
    try {
      const response = await requestServer(
        server,
        `/in-tmux-by-human/missing.v4.json?k=${testToken}`,
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for the flat route when inTmuxDataDir is null', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const response = await requestServer(
        server,
        `/in-tmux-by-human/index.v4.json?k=${testToken}`,
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('webServer dashboard /tdpm.txt route integration', () => {
  const testToken = 'integration-test-token-value';

  const requestServer = (
    server: http.Server,
    requestPath: string,
    method = 'GET',
    headers?: Record<string, string>,
  ): Promise<{
    statusCode: number;
    body: string;
    cacheControl: string | undefined;
    contentType: string | undefined;
    contentLength: string | undefined;
    transferEncoding: string | undefined;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        { host: '127.0.0.1', port, path: requestPath, method, headers },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
              cacheControl: response.headers['cache-control'],
              contentType: response.headers['content-type'],
              contentLength: response.headers['content-length'],
              transferEncoding: response.headers['transfer-encoding'],
            });
          });
        },
      );
      httpRequest.on('error', reject);
      httpRequest.end();
    });
  };

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const writeDataFiles = (dataDir: string): void => {
    fs.mkdirSync(path.join(dataDir, 'projects'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'projects', 'acme.json'),
      JSON.stringify({
        pjcode: 'acme',
        capturedAt: '2026-06-26T00:00:00.000Z',
        todo: 1,
        qc: 2,
        fail: 0,
        pr: 0,
        ws: 4,
        dep: 1,
        blocker: 0,
      }),
    );
    fs.writeFileSync(
      path.join(dataDir, 'projects', 'initech.json'),
      JSON.stringify({
        pjcode: 'initech',
        capturedAt: '2026-06-26T00:00:00.000Z',
        todo: 0,
        qc: 0,
        fail: 0,
        pr: 0,
        ws: 2,
        dep: 0,
        blocker: 0,
      }),
    );
    fs.writeFileSync(
      path.join(dataDir, 'machine-status.json'),
      JSON.stringify({
        memPct: 55,
        cpuPct: 62,
        diskPct: 89,
        load: [16, 23, 40],
        cycleMinutes: 14,
        capturedAt: '2026-06-26T00:00:00.000Z',
      }),
    );
    fs.writeFileSync(
      path.join(dataDir, 'token-status.json'),
      JSON.stringify({
        tokens: [
          {
            name: 'alice',
            fiveHourUtilizationPercent: 10,
            fiveHourResetSeconds: 3600,
            sevenDayUtilizationPercent: 12,
            sevenDayResetSeconds: 432000,
            color: 'G',
            prep: 2,
            hum: 1,
          },
        ],
        capturedAt: '2026-06-26T00:00:00.000Z',
      }),
    );
  };

  const expectedComposed =
    '<tt>M55%&nbsp;C62%&nbsp;D89%&nbsp;cy14</tt><br>\n' +
    '<tt>LA&nbsp;16&nbsp;23&nbsp;40</tt><br>\n' +
    '<tt>pj&nbsp;&nbsp;&nbsp;td&nbsp;qc&nbsp;fl&nbsp;pp&nbsp;ws&nbsp;dp&nbsp;🔴&nbsp;🟡&nbsp;🔵</tt><br>\n' +
    '<tt>🟢ac&nbsp;&nbsp;1&nbsp;&nbsp;2&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;4&nbsp;&nbsp;1&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0</tt><br>\n' +
    '<tt>🟢in&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;2&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0</tt><br>\n' +
    '<tt></tt><br>\n' +
    '<tt>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;1</tt><br>\n' +
    '<tt>🟢ce&nbsp;10&nbsp;0d01h00&nbsp;12&nbsp;5d00h00&nbsp;2&nbsp;1</tt><br>\n';

  const staticDashboardRaw =
    '<tt>STATIC&nbsp;DASHBOARD</tt><br>\n<tt>pj&nbsp;unr&nbsp;tdo</tt><br>\n';

  const writeStaticDashboard = (staticDir: string): void => {
    fs.writeFileSync(path.join(staticDir, 'tdpm.txt'), staticDashboardRaw);
  };

  const startServer = async (overrides: {
    dashboardDir: string | null;
    dashboardDataDir: string | null;
  }): Promise<{ server: http.Server; tmpDir: string }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: overrides.dashboardDir,
      dashboardDataDir: overrides.dashboardDataDir,
      dashboardProjectNames: ['acme', 'initech'],
      port: 0,
    });
    return { server, tmpDir };
  };

  it('composes /tdpm.txt from the data files when dashboardDataDir is set and every file is present', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-data-'));
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeDataFiles(dataDir);
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: dataDir,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(expectedComposed);
      expect(response.contentType).toBe('text/html; charset=utf-8');
      expect(response.contentLength).toBe(
        String(Buffer.byteLength(expectedComposed)),
      );
      expect(response.transferEncoding).toBeUndefined();
      expect(response.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('serves the static tdpm.txt unchanged when dashboardDataDir is unset', async () => {
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(staticDashboardRaw);
      expect(response.contentType).toBe('text/html; charset=utf-8');
      expect(response.contentLength).toBe(
        String(Buffer.byteLength(staticDashboardRaw)),
      );
      expect(response.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('falls back to the static tdpm.txt when dashboardDataDir is set but the data files are absent', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-data-'));
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: dataDir,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(staticDashboardRaw);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('falls back to the static tdpm.txt when only some data files are present', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-data-'));
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    fs.writeFileSync(
      path.join(dataDir, 'machine-status.json'),
      JSON.stringify({
        memPct: 55,
        cpuPct: 62,
        diskPct: 89,
        load: [16, 23, 40],
        cycleMinutes: 14,
        capturedAt: '2026-06-26T00:00:00.000Z',
      }),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: dataDir,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(staticDashboardRaw);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for /tdpm.txt when the static file is absent and compose mode is inactive', async () => {
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for /tdpm.txt when both dashboardDir and dashboardDataDir are null', async () => {
    const { server, tmpDir } = await startServer({
      dashboardDir: null,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a non-GET method on /tdpm.txt with 404', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-data-'));
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeDataFiles(dataDir);
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: dataDir,
    });
    try {
      const response = await requestServer(server, '/tdpm.txt', 'POST');
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('returns 401 for GET /tdpm.txt without a token', async () => {
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, '/tdpm.txt');
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('returns 401 for GET /tdpm.txt with wrong token via query param', async () => {
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, '/tdpm.txt?k=wrong-token');
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('returns 200 for GET /tdpm.txt with valid token via x-pv-token header', async () => {
    const staticDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'dashboard-static-'),
    );
    writeStaticDashboard(staticDir);
    const { server, tmpDir } = await startServer({
      dashboardDir: staticDir,
      dashboardDataDir: null,
    });
    try {
      const response = await requestServer(server, '/tdpm.txt', 'GET', {
        [CONSOLE_TOKEN_HEADER]: testToken,
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(staticDashboardRaw);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });
});

describe('webServer image proxy', () => {
  const testToken = 'image-proxy-token-value';
  const githubToken = 'gh-token-value';
  const allowedUrl = 'https://github.com/user-attachments/assets/abc-123';
  const itemUrl = 'https://github.com/owner-name/repo-name/issues/12';
  const itemUrlParam = `&itemUrl=${encodeURIComponent(itemUrl)}`;

  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  const stubFetcher: ImageFetcher = async () => ({
    status: 200,
    contentType: 'image/png',
    body: pngBytes,
  });

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const requestImage = (
    server: http.Server,
    requestPath: string,
  ): Promise<{
    statusCode: number;
    contentType: string | undefined;
    contentLength: string | undefined;
    cacheControl: string | undefined;
    body: Buffer;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port, path: requestPath, method: 'GET' },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              contentType: response.headers['content-type'],
              contentLength: response.headers['content-length'],
              cacheControl: response.headers['cache-control'],
              body: Buffer.concat(chunks),
            });
          });
        },
      );
      request.on('error', reject);
      request.end();
    });
  };

  const startProxyServer = (
    fetcher: ImageFetcher | null = stubFetcher,
    token: string | null = githubToken,
  ): Promise<{ server: http.Server; tmpDir: string }> =>
    (async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
      const server = await startWebServer({
        accessToken: testToken,
        uiDistDir: path.join(tmpDir, 'ui-dist'),
        consoleDataOutputDir: null,
        inTmuxDataDir: null,
        dashboardDir: null,
        dashboardDataDir: null,
        dashboardProjectNames: [],
        resolveGithubToken: token === null ? null : (): string => token,
        imageFetcher: fetcher,
        port: 0,
      });
      return { server, tmpDir };
    })();

  it('returns image bytes for an allow-listed url with a valid token', async () => {
    const { server, tmpDir } = await startProxyServer();
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}${itemUrlParam}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(response.contentType).toBe('image/png');
      expect(response.contentLength).toBe(String(pngBytes.length));
      expect(response.cacheControl).toBe('private, max-age=300');
      expect(Array.from(response.body)).toEqual(Array.from(pngBytes));
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a non-allow-listed url with 400', async () => {
    const { server, tmpDir } = await startProxyServer();
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent('https://example.com/x.png')}${itemUrlParam}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(400);
      expect(response.body.toString('utf-8')).toContain(
        'not in allowed domain',
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a request without a token with 401', async () => {
    const { server, tmpDir } = await startProxyServer();
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}`,
      );
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a request with an invalid token with 401', async () => {
    const { server, tmpDir } = await startProxyServer();
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}&k=wrong-token`,
      );
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 502 when the github token is not configured', async () => {
    const { server, tmpDir } = await startProxyServer(stubFetcher, null);
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}${itemUrlParam}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(502);
      expect(response.body.toString('utf-8')).toContain(
        'github token is not configured',
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fetches the image with the token resolved for the repository owner of the item', async () => {
    const receivedHeaders: Record<string, string>[] = [];
    const recordingFetcher: ImageFetcher = async (_url, headers) => {
      receivedHeaders.push(headers);
      return { status: 200, contentType: 'image/png', body: pngBytes };
    };
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      resolveGithubToken: (repositoryOwner: string): string =>
        repositoryOwner === 'acme' ? 'acme-token' : githubToken,
      imageFetcher: recordingFetcher,
      port: 0,
    });
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}&itemUrl=${encodeURIComponent('https://github.com/acme/repo/issues/7')}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(receivedHeaders).toHaveLength(1);
      expect(receivedHeaders[0]['Authorization']).toBe('token acme-token');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects an image request whose item url is missing with 400', async () => {
    const { server, tmpDir } = await startProxyServer();
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(400);
      expect(response.body.toString('utf-8')).toContain('itemUrl');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 502 when the upstream image fetch fails', async () => {
    const failingFetcher: ImageFetcher = async () => ({
      status: 404,
      contentType: null,
      body: Buffer.alloc(0),
    });
    const { server, tmpDir } = await startProxyServer(failingFetcher);
    try {
      const response = await requestImage(
        server,
        `/api/img?url=${encodeURIComponent(allowedUrl)}${itemUrlParam}&k=${testToken}`,
      );
      expect(response.statusCode).toBe(502);
      expect(response.body.toString('utf-8')).toContain('upstream 404');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('webServer token cookie redirect', () => {
  const testToken = 'integration-test-token-value';

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const requestServer = (
    server: http.Server,
    requestPath: string,
    headers: http.OutgoingHttpHeaders = {},
  ): Promise<{
    statusCode: number;
    body: string;
    location: string | undefined;
    setCookie: string[] | undefined;
    referrerPolicy: string | string[] | undefined;
    cacheControl: string | undefined;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        { host: '127.0.0.1', port, path: requestPath, headers },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
              location: response.headers['location'],
              setCookie: response.headers['set-cookie'],
              referrerPolicy: response.headers['referrer-policy'],
              cacheControl: response.headers['cache-control'],
            });
          });
        },
      );
      httpRequest.on('error', reject);
      httpRequest.end();
    });
  };

  const startWithUiDist = async (): Promise<{
    server: http.Server;
    tmpDir: string;
  }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const uiDistDir = path.join(tmpDir, 'ui-dist');
    fs.mkdirSync(uiDistDir, { recursive: true });
    fs.writeFileSync(
      path.join(uiDistDir, 'index.html'),
      '<!DOCTYPE html><title>spa</title><div id="root"></div>',
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    return { server, tmpDir };
  };

  const firstSetCookie = (setCookie: string[] | undefined): string => {
    expect(setCookie).toBeDefined();
    expect(setCookie).toHaveLength(1);
    return (setCookie ?? [''])[0];
  };

  it('redirects a per-project app route carrying ?k= to the keyless path and sets an HttpOnly SameSite=Strict cookie', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const response = await requestServer(
        server,
        `/projects/acme?k=${testToken}`,
      );
      expect(response.statusCode).toBe(302);
      expect(response.location).toBe('/projects/acme');
      expect(response.body).not.toContain(testToken);
      const cookie = firstSetCookie(response.setCookie);
      expect(cookie).toContain(`${CONSOLE_TOKEN_COOKIE}=${testToken}`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/');
      expect(response.referrerPolicy).toBe('no-referrer');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('sets a token cookie that survives a browser restart by carrying a long Max-Age', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const response = await requestServer(
        server,
        `/projects/acme?k=${testToken}`,
      );
      const cookie = firstSetCookie(response.setCookie);
      const maxAgeAttribute = /(?:^|;\s*)Max-Age=(\d+)\s*(?:;|$)/i.exec(cookie);
      expect(maxAgeAttribute).not.toBeNull();
      expect(Number((maxAgeAttribute ?? ['', '0'])[1])).toBeGreaterThanOrEqual(
        30 * 24 * 60 * 60,
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('redirects a per-project tab route carrying ?k= and preserves other query parameters', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const response = await requestServer(
        server,
        `/projects/globex/prs?k=${testToken}&foo=bar`,
      );
      expect(response.statusCode).toBe(302);
      expect(response.location).toBe('/projects/globex/prs?foo=bar');
      const cookie = firstSetCookie(response.setCookie);
      expect(cookie).toContain(`${CONSOLE_TOKEN_COOKIE}=${testToken}`);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('redirects the root and index.html routes carrying ?k= to a keyless path', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const root = await requestServer(server, `/?k=${testToken}`);
      expect(root.statusCode).toBe(302);
      expect(root.location).toBe('/');
      expect(firstSetCookie(root.setCookie)).toContain(
        `${CONSOLE_TOKEN_COOKIE}=${testToken}`,
      );

      const indexHtml = await requestServer(
        server,
        `/index.html?k=${testToken}`,
      );
      expect(indexHtml.statusCode).toBe(302);
      expect(indexHtml.location).toBe('/index.html');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves the app route without a token and never leaks a token in the URL', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const response = await requestServer(server, '/projects/acme');
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('spa');
      expect(response.setCookie).toBeUndefined();
      expect(response.referrerPolicy).toBe('no-referrer');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('sets Referrer-Policy: no-referrer on the console HTML responses', async () => {
    const { server, tmpDir } = await startWithUiDist();
    try {
      const root = await requestServer(server, '/');
      expect(root.statusCode).toBe(200);
      expect(root.referrerPolicy).toBe('no-referrer');

      const projectTab = await requestServer(server, '/projects/globex/prs');
      expect(projectTab.statusCode).toBe(200);
      expect(projectTab.referrerPolicy).toBe('no-referrer');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('authenticates a data list request through the cookie without a token in the URL', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const dataDir = path.join(tmpDir, 'data');
    const listDir = path.join(dataDir, 'acme', 'prs');
    fs.mkdirSync(listDir, { recursive: true });
    fs.writeFileSync(
      path.join(listDir, 'list.json'),
      JSON.stringify({ pjcode: 'acme', items: [] }),
    );
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: dataDir,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const withCookie = await requestServer(
        server,
        '/projects/acme/prs/list.json',
        { Cookie: `${CONSOLE_TOKEN_COOKIE}=${testToken}` },
      );
      expect(withCookie.statusCode).toBe(200);
      expect(JSON.parse(withCookie.body)).toEqual({
        pjcode: 'acme',
        items: [],
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a data or api request when no token and no cookie are present', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const noToken = await requestServer(server, '/data/situation.json');
      expect(noToken.statusCode).toBe(401);

      const wrongCookie = await requestServer(server, '/api/review', {
        Cookie: `${CONSOLE_TOKEN_COOKIE}=wrong-token`,
      });
      expect(wrongCookie.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

const toPlainValue = (document: { toJS: () => unknown }): unknown =>
  document.toJS();

describe('webServer owner call file route', () => {
  const testToken = 'owner-call-token-value';
  const sessionName = toTmuxSessionName(
    'https://github.com/OWNER/REPO/issues/1',
  );
  const ownerCall = {
    sessionName,
    calledAt: '2026-08-14T04:22:28Z',
    body: '  the first line of the call body.\n\na later line of the call body.\n',
  };

  const requestServer = (
    server: http.Server,
    requestPath: string,
    method = 'GET',
  ): Promise<{
    statusCode: number;
    body: string;
    contentType: string | undefined;
  }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        { host: '127.0.0.1', port: address.port, path: requestPath, method },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
              contentType: response.headers['content-type'],
            });
          });
        },
      );
      httpRequest.on('error', reject);
      httpRequest.end();
    });
  };

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const startWithOwnerCallFile = async (
    projectCode: string | null,
  ): Promise<{
    server: http.Server;
    tmpDir: string;
    inTmuxDataDir: string;
    requestPath: string;
  }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-server-'));
    const inTmuxDataDir = path.join(tmpDir, 'in-tmux-by-human');
    fs.mkdirSync(inTmuxDataDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'secret.yaml'), 'secret: true\n');
    ownerCallFileAppend({ dataDir: inTmuxDataDir, projectCode, ownerCall });
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    return {
      server,
      tmpDir,
      inTmuxDataDir,
      requestPath: `/in-tmux-by-human/${ownerCallFileRelativePath(
        projectCode,
        sessionName,
      )}`,
    };
  };

  it('requires a token for the owner call file path', () => {
    expect(
      requiresToken(
        `/in-tmux-by-human/${ownerCallFileRelativePath('umino', sessionName)}`,
      ),
    ).toBe(true);
  });

  it('recognizes only the owner call file path as deletable', () => {
    expect(
      isOwnerCallFileRequestPath(
        `/in-tmux-by-human/${ownerCallFileRelativePath('umino', sessionName)}`,
      ),
    ).toBe(true);
    expect(isOwnerCallFileRequestPath('/in-tmux-by-human/index.v4.json')).toBe(
      false,
    );
    expect(
      isOwnerCallFileRequestPath('/in-tmux-by-human/call-to-user/umino.yaml'),
    ).toBe(false);
  });

  it('resolves the owner call file the append entry point writes, without a hardcoded path', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-path-'));
    try {
      ownerCallFileAppend({
        dataDir,
        projectCode: 'umino',
        ownerCall,
      });
      const relativePath = ownerCallFileRelativePath('umino', sessionName);

      const resolved = resolveFlatInTmuxFilePath(
        dataDir,
        `/in-tmux-by-human/${relativePath}`,
      );

      expect(resolved).not.toBeNull();
      expect(fs.readFileSync(String(resolved), 'utf-8')).toBe(
        fs.readFileSync(path.join(dataDir, relativePath), 'utf-8'),
      );
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('serves, then deletes, the file the append entry point wrote', async () => {
    const { server, tmpDir, requestPath } =
      await startWithOwnerCallFile('umino');
    try {
      const fetched = await requestServer(
        server,
        `${requestPath}?k=${testToken}`,
      );
      expect(fetched.statusCode).toBe(200);
      expect(fetched.contentType).toContain('text/yaml');
      const documents = parseAllDocuments(fetched.body);
      expect(documents).toHaveLength(1);
      expect(documents[0].toJS()).toEqual(ownerCall);

      const deleted = await requestServer(
        server,
        `${requestPath}?k=${testToken}`,
        'DELETE',
      );
      expect(deleted.statusCode).toBe(204);

      const refetched = await requestServer(
        server,
        `${requestPath}?k=${testToken}`,
      );
      expect(refetched.statusCode).toBe(404);

      const deletedAgain = await requestServer(
        server,
        `${requestPath}?k=${testToken}`,
        'DELETE',
      );
      expect(deletedAgain.statusCode).toBe(204);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves two appended documents oldest first', async () => {
    const { server, tmpDir, inTmuxDataDir, requestPath } =
      await startWithOwnerCallFile(null);
    try {
      ownerCallFileAppend({
        dataDir: inTmuxDataDir,
        projectCode: null,
        ownerCall: {
          sessionName,
          calledAt: '2026-08-14T05:00:00Z',
          body: 'the newer call\n',
        },
      });

      const fetched = await requestServer(
        server,
        `${requestPath}?k=${testToken}`,
      );
      expect(fetched.statusCode).toBe(200);
      expect(parseAllDocuments(fetched.body).map(toPlainValue)).toEqual([
        ownerCall,
        {
          sessionName,
          calledAt: '2026-08-14T05:00:00Z',
          body: 'the newer call\n',
        },
      ]);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a request that carries no access token', async () => {
    const { server, tmpDir, requestPath } =
      await startWithOwnerCallFile('umino');
    try {
      expect((await requestServer(server, requestPath)).statusCode).toBe(401);
      expect(
        (await requestServer(server, requestPath, 'DELETE')).statusCode,
      ).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a request whose path escapes the data directory and leaves the outside file untouched', async () => {
    const { server, tmpDir } = await startWithOwnerCallFile('umino');
    const escapingPath = '/in-tmux-by-human/call-to-user/../../secret.yaml';
    try {
      const fetched = await requestServer(
        server,
        `${escapingPath}?k=${testToken}`,
      );
      expect(fetched.statusCode).toBe(404);
      expect(fetched.body).not.toContain('secret: true');

      const deleted = await requestServer(
        server,
        `${escapingPath}?k=${testToken}`,
        'DELETE',
      );
      expect(deleted.statusCode).toBe(404);
      expect(fs.existsSync(path.join(tmpDir, 'secret.yaml'))).toBe(true);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('refuses to delete a flat in-tmux json file through the owner call route', async () => {
    const { server, tmpDir, inTmuxDataDir } =
      await startWithOwnerCallFile('umino');
    fs.writeFileSync(
      path.join(inTmuxDataDir, 'index.v4.json'),
      '{"version":4,"projects":[]}\n',
    );
    try {
      const deleted = await requestServer(
        server,
        `/in-tmux-by-human/index.v4.json?k=${testToken}`,
        'DELETE',
      );
      expect(deleted.statusCode).toBe(404);
      expect(fs.existsSync(path.join(inTmuxDataDir, 'index.v4.json'))).toBe(
        true,
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('webServer GET /api/projects', () => {
  const testToken = 'integration-test-token-value';

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const request = (
    server: http.Server,
    method: string,
    requestPath: string,
  ): Promise<{ statusCode: number; body: string }> => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('server is not listening on a TCP port');
    }
    const port = address.port;
    return new Promise((resolve, reject) => {
      const httpRequest = http.request(
        { host: '127.0.0.1', port, path: requestPath, method },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf-8'),
            });
          });
        },
      );
      httpRequest.on('error', reject);
      httpRequest.end();
    });
  };

  it('returns the dashboardProjectNames with a valid token and null workflowImprovementIssueUrl when not configured', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: ['alpha', 'beta', 'gamma'],
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/projects?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        pjcodes: ['alpha', 'beta', 'gamma'],
        workflowImprovementIssueUrl: null,
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns the workflowImprovementIssueUrl when configured', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: ['alpha'],
      workflowImprovementIssueUrl:
        'https://github.com/owner/repo/issues/new?assignees=someone',
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/projects?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        pjcodes: ['alpha'],
        workflowImprovementIssueUrl:
          'https://github.com/owner/repo/issues/new?assignees=someone',
      });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 401 without a valid token', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: ['alpha'],
      port: 0,
    });
    try {
      const response = await request(server, 'GET', '/api/projects');
      expect(response.statusCode).toBe(401);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('GET /api/features returns { airplaneMode: false } when enableAirplaneMode is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/features?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ airplaneMode: false });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('GET /api/features returns { airplaneMode: true } when enableAirplaneMode is true', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      enableAirplaneMode: true,
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/features?k=${testToken}`,
      );
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ airplaneMode: true });
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('GET /api/airplanesync returns 404 when enableAirplaneMode is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/airplanesync?k=${testToken}`,
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('GET /api/airplanesync returns 404 when enableAirplaneMode is false', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startWebServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      dashboardDataDir: null,
      dashboardProjectNames: [],
      enableAirplaneMode: false,
      port: 0,
    });
    try {
      const response = await request(
        server,
        'GET',
        `/api/airplanesync?k=${testToken}`,
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
