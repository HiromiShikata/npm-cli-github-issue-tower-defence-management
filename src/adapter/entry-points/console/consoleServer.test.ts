import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_CONSOLE_PORT,
  CONSOLE_TOKEN_HEADER,
  hasDotSegment,
  requiresToken,
  isTokenValid,
  extractProvidedToken,
  startConsoleServer,
} from './consoleServer';

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
