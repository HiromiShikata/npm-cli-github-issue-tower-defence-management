import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_CONSOLE_PORT = 9981;

export const CONSOLE_TOKEN_HEADER = 'x-pv-token';

const PLACEHOLDER_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TDPM Console</title>
  </head>
  <body>
    <main>
      <h1>TDPM Console</h1>
      <p>The console UI bundle has not been built yet.</p>
    </main>
  </body>
</html>
`;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const hasDotSegment = (requestPath: string): boolean =>
  requestPath
    .split('/')
    .some((segment) => segment.length > 0 && segment.startsWith('.'));

export const requiresToken = (requestPath: string): boolean =>
  requestPath.startsWith('/api/') ||
  requestPath === '/api' ||
  requestPath.endsWith('.json');

export const isTokenValid = (
  expectedToken: string,
  providedToken: string | null,
): boolean => providedToken !== null && providedToken === expectedToken;

export const extractProvidedToken = (
  queryToken: string | string[] | null,
  headerToken: string | string[] | undefined,
): string | null => {
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  if (typeof headerToken === 'string' && headerToken.length > 0) {
    return headerToken;
  }
  return null;
};

const contentTypeForPath = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES[extension] ?? 'application/octet-stream';
};

const resolveStaticFilePath = (
  uiDistDir: string,
  requestPath: string,
): string | null => {
  const relativePath = requestPath === '/' ? '/index.html' : requestPath;
  const normalized = path
    .normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = path.join(uiDistDir, normalized);
  const resolvedRoot = path.resolve(uiDistDir);
  const resolvedCandidate = path.resolve(candidate);
  if (
    resolvedCandidate !== resolvedRoot &&
    !resolvedCandidate.startsWith(resolvedRoot + path.sep)
  ) {
    return null;
  }
  return resolvedCandidate;
};

const readStaticFile = (filePath: string): Buffer | null => {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
};

export type ConsoleServerOptions = {
  accessToken: string;
  uiDistDir: string;
  consoleDataOutputDir: string | null;
};

const sendNotFound = (response: http.ServerResponse): void => {
  response.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end('Not Found');
};

const sendUnauthorized = (response: http.ServerResponse): void => {
  response.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end('Unauthorized');
};

const serveBootstrapIndex = (response: http.ServerResponse): void => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(PLACEHOLDER_INDEX_HTML);
};

export const handleConsoleRequest = (
  options: ConsoleServerOptions,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): void => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const requestPath = requestUrl.pathname;

  if (hasDotSegment(requestPath)) {
    sendNotFound(response);
    return;
  }

  if (requiresToken(requestPath)) {
    const providedToken = extractProvidedToken(
      requestUrl.searchParams.get('k'),
      request.headers[CONSOLE_TOKEN_HEADER],
    );
    if (!isTokenValid(options.accessToken, providedToken)) {
      sendUnauthorized(response);
      return;
    }
    sendNotFound(response);
    return;
  }

  if (requestPath === '/' || requestPath === '/index.html') {
    const indexFilePath = resolveStaticFilePath(
      options.uiDistDir,
      '/index.html',
    );
    const indexContent =
      indexFilePath === null ? null : readStaticFile(indexFilePath);
    if (indexContent === null) {
      serveBootstrapIndex(response);
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(indexContent);
    return;
  }

  const staticFilePath = resolveStaticFilePath(options.uiDistDir, requestPath);
  if (staticFilePath === null) {
    sendNotFound(response);
    return;
  }
  const staticContent = readStaticFile(staticFilePath);
  if (staticContent === null) {
    sendNotFound(response);
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypeForPath(staticFilePath),
    'Cache-Control': 'no-store',
  });
  response.end(staticContent);
};

export const createConsoleServer = (
  options: ConsoleServerOptions,
): http.Server =>
  http.createServer((request, response) => {
    handleConsoleRequest(options, request, response);
  });

export type StartConsoleServerOptions = ConsoleServerOptions & {
  port: number;
};

export const startConsoleServer = (
  options: StartConsoleServerOptions,
): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = createConsoleServer(options);
    server.once('error', reject);
    server.listen(options.port, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
