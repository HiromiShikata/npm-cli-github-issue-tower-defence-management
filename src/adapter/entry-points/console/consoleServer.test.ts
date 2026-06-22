import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import {
  DEFAULT_CONSOLE_PORT,
  CONSOLE_TOKEN_HEADER,
  hasDotSegment,
  requiresToken,
  isTokenValid,
  isConsoleAppRoute,
  extractProvidedToken,
  resolveFlatInTmuxFilePath,
  resolveDashboardFilePath,
  startConsoleServer,
} from './consoleServer';
import { IssueTitleStateCache } from './consoleReadApi';
import { readDoneProjectItemIds } from './consoleDoneStore';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';

describe('consoleServer pure helpers', () => {
  describe('DEFAULT_CONSOLE_PORT', () => {
    it('is 9981', () => {
      expect(DEFAULT_CONSOLE_PORT).toBe(9981);
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

    it('requires a token for the dashboard /tdpm.txt path', () => {
      expect(requiresToken('/tdpm.txt')).toBe(true);
    });

    it('does not require a token for bootstrap assets', () => {
      expect(requiresToken('/')).toBe(false);
      expect(requiresToken('/index.html')).toBe(false);
      expect(requiresToken('/assets/app.js')).toBe(false);
    });
  });

  describe('isConsoleAppRoute', () => {
    it('matches a per-project root route', () => {
      expect(isConsoleAppRoute('/projects/umino')).toBe(true);
      expect(isConsoleAppRoute('/projects/umino/')).toBe(true);
    });

    it('matches a per-project tab route for every list tab', () => {
      expect(isConsoleAppRoute('/projects/umino/prs')).toBe(true);
      expect(isConsoleAppRoute('/projects/xmile/triage')).toBe(true);
      expect(isConsoleAppRoute('/projects/xcare/unread')).toBe(true);
      expect(isConsoleAppRoute('/projects/utage3/failed-preparation')).toBe(
        true,
      );
      expect(isConsoleAppRoute('/projects/utage3/todo-by-human')).toBe(true);
    });

    it('does not match data, api, or unknown tab routes', () => {
      expect(isConsoleAppRoute('/projects/umino/prs/list.json')).toBe(false);
      expect(isConsoleAppRoute('/projects/umino/unknown')).toBe(false);
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
      expect(extractProvidedToken('fromQuery', 'fromHeader')).toBe('fromQuery');
    });

    it('falls back to the header token', () => {
      expect(extractProvidedToken(null, 'fromHeader')).toBe('fromHeader');
    });

    it('returns null when neither is present', () => {
      expect(extractProvidedToken(null, undefined)).toBeNull();
      expect(extractProvidedToken('', undefined)).toBeNull();
    });
  });
});

describe('consoleServer integration', () => {
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      port: 0,
    });
    try {
      const projectRoot = await requestServer(server, '/projects/umino');
      expect(projectRoot.statusCode).toBe(200);
      expect(projectRoot.body).toContain('spa');
      expect(projectRoot.contentType).toContain('text/html');
      expect(projectRoot.cacheControl).toBe('no-store');

      const projectTab = await requestServer(server, '/projects/xmile/prs');
      expect(projectTab.statusCode).toBe(200);
      expect(projectTab.body).toContain('spa');

      const unknownTab = await requestServer(server, '/projects/xmile/unknown');
      expect(unknownTab.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('serves the placeholder index for per-project routes when ui-dist is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'missing-ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      port: 0,
    });
    try {
      const projectRoot = await requestServer(server, '/projects/umino/triage');
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir,
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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

describe('consoleServer new routes integration', () => {
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

  it('serves a data list file with the done exclusion through the token gate', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const dataDir = path.join(tmpDir, 'data');
    const listDir = path.join(dataDir, 'umino', 'prs');
    fs.mkdirSync(listDir, { recursive: true });
    fs.writeFileSync(
      path.join(listDir, 'list.json'),
      JSON.stringify({
        pjcode: 'umino',
        items: [{ projectItemId: 'PVTI_keep' }, { projectItemId: 'PVTI_drop' }],
      }),
    );
    fs.writeFileSync(
      path.join(listDir, '.done.json'),
      JSON.stringify({ projectItemIds: ['PVTI_drop'] }),
    );
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: dataDir,
      inTmuxDataDir: null,
      dashboardDir: null,
      port: 0,
    });
    try {
      const unauthorized = await request(
        server,
        'GET',
        '/projects/umino/prs/list.json',
      );
      expect(unauthorized.statusCode).toBe(401);

      const authorized = await request(
        server,
        'GET',
        `/projects/umino/prs/list.json?k=${testToken}`,
      );
      expect(authorized.statusCode).toBe(200);
      const parsed: unknown = JSON.parse(authorized.body);
      expect(parsed).toEqual({
        pjcode: 'umino',
        items: [{ projectItemId: 'PVTI_keep' }],
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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

  it('posts a comment through the comment operation api', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      {
        author: 'HiromiShikata',
        body: 'Thanks, this resolves the parity gap.',
        createdAt: new Date('2026-06-18T03:21:00.000Z'),
      },
    ]);
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'umino' ? { pjcode, project: buildProject() } : null,
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/comment?k=${testToken}`,
        {
          pjcode: 'umino',
          url: 'https://github.com/o/r/issues/1',
          body: 'Thanks, this resolves the parity gap.',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(issueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/o/r/issues/1',
        'Thanks, this resolves the parity gap.',
      );
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: dataDir,
      inTmuxDataDir: null,
      dashboardDir: null,
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'umino' ? { pjcode, project: buildProject() } : null,
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/review?k=${testToken}`,
        {
          pjcode: 'umino',
          action: 'approve',
          prUrl: 'https://github.com/o/r/pull/1',
          projectItemId: 'PVTI_op',
        },
      );
      expect(response.statusCode).toBe(200);
      expect(issueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/o/r/pull/1',
      );
      expect(readDoneProjectItemIds(dataDir, 'umino', 'prs')).toContain(
        'PVTI_op',
      );
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects an operation api with a malformed json body', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const issueRepository = mock<IssueRepository>();
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
      issueRepository,
      resolveProject: async (pjcode) =>
        pjcode === 'umino' ? { pjcode, project: buildProject() } : null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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
      resolveFlatInTmuxFilePath(baseDir, '/projects/umino/in-tmux-by-human/x'),
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
});

describe('consoleServer flat in-tmux-by-human route integration', () => {
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
    '{"version":4,"projects":[{"name":"umino","path":"/in-tmux-by-human/umino.v4.json?k=secret"}]}\n';
  const indexV3Raw = '{"version":3,"projects":["umino"]}\n';

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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir,
      dashboardDir: null,
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
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: null,
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

describe('resolveDashboardFilePath', () => {
  const baseDir = path.join(os.tmpdir(), 'dashboard-data');

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

describe('consoleServer dashboard /tdpm.txt route integration', () => {
  const testToken = 'integration-test-token-value';

  const requestServer = (
    server: http.Server,
    requestPath: string,
    method = 'GET',
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
        { host: '127.0.0.1', port, path: requestPath, method },
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

  const dashboardRaw =
    '<tt>MEM&nbsp;30%</tt><br>\n<tt>pj&nbsp;unr&nbsp;tdo</tt><br>\n';

  const startWithDashboard = async (): Promise<{
    server: http.Server;
    tmpDir: string;
  }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    fs.writeFileSync(path.join(tmpDir, 'tdpm.txt'), dashboardRaw);
    fs.writeFileSync(path.join(tmpDir, 'secret.txt'), 'secret content');
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: tmpDir,
      port: 0,
    });
    return { server, tmpDir };
  };

  it('serves /tdpm.txt with a valid token, byte-identical, as text/html with an explicit Content-Length and no chunked encoding', async () => {
    const { server, tmpDir } = await startWithDashboard();
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBe(dashboardRaw);
      expect(response.contentType).toBe('text/html; charset=utf-8');
      expect(response.contentLength).toBe(
        String(Buffer.byteLength(dashboardRaw)),
      );
      expect(response.transferEncoding).toBeUndefined();
      expect(response.cacheControl).toBe('no-store');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects /tdpm.txt without a token and does not disclose the dashboard body', async () => {
    const { server, tmpDir } = await startWithDashboard();
    try {
      const response = await requestServer(server, '/tdpm.txt');
      expect(response.statusCode).toBe(401);
      expect(response.body).not.toContain('MEM');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects /tdpm.txt with a wrong token', async () => {
    const { server, tmpDir } = await startWithDashboard();
    try {
      const response = await requestServer(server, '/tdpm.txt?k=wrong-token');
      expect(response.statusCode).toBe(401);
      expect(response.body).not.toContain('MEM');
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for /tdpm.txt with a valid token when the file is absent', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
    const server = await startConsoleServer({
      accessToken: testToken,
      uiDistDir: path.join(tmpDir, 'ui-dist'),
      consoleDataOutputDir: null,
      inTmuxDataDir: null,
      dashboardDir: tmpDir,
      port: 0,
    });
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for /tdpm.txt with a valid token when dashboardDir is null', async () => {
    const { server, tmpDir } = await (async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-server-'));
      fs.writeFileSync(path.join(dir, 'tdpm.txt'), dashboardRaw);
      const srv = await startConsoleServer({
        accessToken: testToken,
        uiDistDir: path.join(dir, 'ui-dist'),
        consoleDataOutputDir: null,
        inTmuxDataDir: null,
        dashboardDir: null,
        port: 0,
      });
      return { server: srv, tmpDir: dir };
    })();
    try {
      const response = await requestServer(server, `/tdpm.txt?k=${testToken}`);
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects a non-GET method on /tdpm.txt with a valid token with 404', async () => {
    const { server, tmpDir } = await startWithDashboard();
    try {
      const response = await requestServer(
        server,
        `/tdpm.txt?k=${testToken}`,
        'POST',
      );
      expect(response.statusCode).toBe(404);
    } finally {
      await closeServer(server);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
