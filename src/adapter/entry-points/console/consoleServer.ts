import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import {
  CONSOLE_LIST_TAB_NAMES,
  buildConsoleDataResponse,
  parseConsoleDataRoute,
} from './consoleDataDelivery';
import {
  IssueTitleStateCache,
  handleComments,
  handleIssueTitle,
  handleItemBody,
  handlePrCommits,
  handlePrFiles,
  handleRelatedPrs,
} from './consoleReadApi';
import {
  ConsoleOperationContext,
  ConsoleProjectResolver,
  handleComment,
  handleIntmux,
  handleReview,
  handleTriage,
} from './consoleOperationApi';

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

const SAFE_PJCODE = /^[A-Za-z0-9._-]+$/;

export const isConsoleAppRoute = (requestPath: string): boolean => {
  const segments = requestPath
    .split('/')
    .filter((segment) => segment.length > 0);
  if (segments.length < 2 || segments[0] !== 'projects') {
    return false;
  }
  const pjcode = segments[1];
  if (!SAFE_PJCODE.test(pjcode) || pjcode.startsWith('.')) {
    return false;
  }
  if (segments.length === 2) {
    return true;
  }
  if (segments.length !== 3) {
    return false;
  }
  const tab = segments[2];
  return CONSOLE_LIST_TAB_NAMES.includes(tab);
};

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
  inTmuxDataDir: string | null;
  dashboardDir: string | null;
  issueRepository?: IssueRepository | null;
  resolveProject?: ConsoleProjectResolver | null;
  issueTitleStateCache?: IssueTitleStateCache | null;
};

const FLAT_IN_TMUX_PREFIX = '/in-tmux-by-human/';

const FLAT_IN_TMUX_FILE = /^[A-Za-z0-9._-]+\.json$/;

export const DASHBOARD_REQUEST_PATH = '/tdpm.txt';

const DASHBOARD_FILE_NAME = 'tdpm.txt';

export const resolveDashboardFilePath = (
  dashboardDir: string,
  requestPath: string,
): string | null => {
  if (requestPath !== DASHBOARD_REQUEST_PATH) {
    return null;
  }
  const candidate = path.join(dashboardDir, DASHBOARD_FILE_NAME);
  const resolvedRoot = path.resolve(dashboardDir);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== path.join(resolvedRoot, DASHBOARD_FILE_NAME)) {
    return null;
  }
  return resolvedCandidate;
};

export const resolveFlatInTmuxFilePath = (
  inTmuxDataDir: string,
  requestPath: string,
): string | null => {
  if (!requestPath.startsWith(FLAT_IN_TMUX_PREFIX)) {
    return null;
  }
  const fileName = requestPath.slice(FLAT_IN_TMUX_PREFIX.length);
  if (fileName.length === 0 || !FLAT_IN_TMUX_FILE.test(fileName)) {
    return null;
  }
  const candidate = path.join(inTmuxDataDir, fileName);
  const resolvedRoot = path.resolve(inTmuxDataDir);
  const resolvedCandidate = path.resolve(candidate);
  if (!resolvedCandidate.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return resolvedCandidate;
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

const serveIndexHtml = (
  options: ConsoleServerOptions,
  response: http.ServerResponse,
): void => {
  const indexFilePath = resolveStaticFilePath(options.uiDistDir, '/index.html');
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
};

const sendJson = (
  response: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

const sendDataResponse = (
  response: http.ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void => {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  response.end(body);
};

const readRequestBody = (request: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    request.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    request.on('error', reject);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseRequestBody = (raw: string): Record<string, unknown> | null => {
  if (raw.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  return parsed;
};

const handleReadApi = async (
  options: ConsoleServerOptions,
  requestPath: string,
  searchParams: URLSearchParams,
): Promise<{ statusCode: number; body: unknown } | null> => {
  const issueRepository = options.issueRepository ?? null;
  if (issueRepository === null) {
    return null;
  }
  const cache = options.issueTitleStateCache ?? null;
  const url = searchParams.get('url');
  switch (requestPath) {
    case '/api/itembody':
      return handleItemBody(issueRepository, url);
    case '/api/comments':
      return handleComments(issueRepository, url);
    case '/api/prfiles':
      return handlePrFiles(issueRepository, url);
    case '/api/prcommits':
      return handlePrCommits(issueRepository, url);
    case '/api/relatedprs':
      return handleRelatedPrs(issueRepository, url);
    case '/api/issuetitle':
      if (cache === null) {
        return null;
      }
      return handleIssueTitle(issueRepository, cache, url);
    default:
      return null;
  }
};

const handleOperationApi = async (
  options: ConsoleServerOptions,
  requestPath: string,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: unknown } | null> => {
  const issueRepository = options.issueRepository ?? null;
  const resolveProject = options.resolveProject ?? null;
  if (issueRepository === null || resolveProject === null) {
    return null;
  }
  const context: ConsoleOperationContext = {
    issueRepository,
    resolveProject,
    consoleDataOutputDir: options.consoleDataOutputDir,
  };
  switch (requestPath) {
    case '/api/review':
      return handleReview(context, body);
    case '/api/triage':
      return handleTriage(context, body);
    case '/api/intmux':
      return handleIntmux(context, body);
    case '/api/comment':
      return handleComment(context, body);
    default:
      return null;
  }
};

const handleTokenedRequest = async (
  options: ConsoleServerOptions,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  requestPath: string,
  searchParams: URLSearchParams,
): Promise<void> => {
  const method = (request.method ?? 'GET').toUpperCase();

  if (requestPath.startsWith('/api/')) {
    if (method === 'GET') {
      const readResult = await handleReadApi(
        options,
        requestPath,
        searchParams,
      );
      if (readResult === null) {
        sendNotFound(response);
        return;
      }
      sendJson(response, readResult.statusCode, readResult.body);
      return;
    }
    if (method === 'POST') {
      const raw = await readRequestBody(request);
      const parsedBody = parseRequestBody(raw);
      if (parsedBody === null) {
        sendJson(response, 400, { error: 'invalid JSON body' });
        return;
      }
      const operationResult = await handleOperationApi(
        options,
        requestPath,
        parsedBody,
      );
      if (operationResult === null) {
        sendNotFound(response);
        return;
      }
      sendJson(response, operationResult.statusCode, operationResult.body);
      return;
    }
    sendNotFound(response);
    return;
  }

  if (method === 'GET') {
    if (requestPath.startsWith(FLAT_IN_TMUX_PREFIX)) {
      if (options.inTmuxDataDir === null) {
        sendNotFound(response);
        return;
      }
      const flatFilePath = resolveFlatInTmuxFilePath(
        options.inTmuxDataDir,
        requestPath,
      );
      const flatContent =
        flatFilePath === null ? null : readStaticFile(flatFilePath);
      if (flatContent === null) {
        sendNotFound(response);
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': String(flatContent.length),
      });
      response.end(flatContent);
      return;
    }

    const dataRoute = parseConsoleDataRoute(requestPath);
    if (dataRoute !== null && options.consoleDataOutputDir !== null) {
      const dataResponse = buildConsoleDataResponse(
        options.consoleDataOutputDir,
        dataRoute,
      );
      sendDataResponse(
        response,
        dataResponse.statusCode,
        dataResponse.contentType,
        dataResponse.body,
      );
      return;
    }
  }

  sendNotFound(response);
};

export const handleConsoleRequest = async (
  options: ConsoleServerOptions,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const requestPath = requestUrl.pathname;

  if (hasDotSegment(requestPath)) {
    sendNotFound(response);
    return;
  }

  if (requestPath === DASHBOARD_REQUEST_PATH) {
    const method = (request.method ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      sendNotFound(response);
      return;
    }
    if (options.dashboardDir === null) {
      sendNotFound(response);
      return;
    }
    const dashboardFilePath = resolveDashboardFilePath(
      options.dashboardDir,
      requestPath,
    );
    const dashboardContent =
      dashboardFilePath === null ? null : readStaticFile(dashboardFilePath);
    if (dashboardContent === null) {
      sendNotFound(response);
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(dashboardContent.length),
    });
    response.end(dashboardContent);
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
    await handleTokenedRequest(
      options,
      request,
      response,
      requestPath,
      requestUrl.searchParams,
    );
    return;
  }

  if (
    requestPath === '/' ||
    requestPath === '/index.html' ||
    isConsoleAppRoute(requestPath)
  ) {
    serveIndexHtml(options, response);
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

const sendInternalServerError = (response: http.ServerResponse): void => {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(500, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end('Internal Server Error');
};

export const createConsoleServer = (
  options: ConsoleServerOptions,
): http.Server =>
  http.createServer((request, response) => {
    handleConsoleRequest(options, request, response).catch((error) => {
      console.error('console request failed', error);
      sendInternalServerError(response);
    });
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
