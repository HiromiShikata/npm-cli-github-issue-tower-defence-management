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
      pjcode: 'umino',
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
      pjcode: 'umino',
      issueRepository,
      project: buildProject(),
      port: 0,
    });
    try {
      const response = await request(
        server,
        'POST',
        `/api/review?k=${testToken}`,
        {
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
      issueRepository,
      project: buildProject(),
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
