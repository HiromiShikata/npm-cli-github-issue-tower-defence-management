import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { IssueAttachmentRepository } from '../../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import {
  CONSOLE_LIST_TAB_NAMES,
  buildConsoleDataResponse,
  parseConsoleDataRoute,
} from './consoleDataDelivery';
import {
  IssueTitleStateCache,
  PullRequestStatusCache,
  handleComments,
  handleIssueTitle,
  handleItemBody,
  handlePrCommits,
  handlePrFiles,
  handlePullRequestStatus,
  handleRelatedPrs,
} from './consoleReadApi';
import {
  ConsoleIssueRepositoryResolver,
  ConsoleOperationContext,
  ConsolePjcodeValidator,
  ConsoleProjectRepositoryResolver,
  ConsoleProjectResolver,
  handleAddStory,
  handleAttachmentUpload,
  handleComment,
  handleCreateIssue,
  handleIntmux,
  handleReorderStory,
  handleReview,
  handleReviewComment,
  handleTriage,
} from './consoleOperationApi';
import { ImageFetcher, fetchProxiedImage } from './consoleImageProxy';
import {
  ConsoleGithubTokenResolver,
  extractRepositoryOwner,
} from './consoleGithubTokenResolver';
import {
  composeDashboardText,
  dashboardComposeFilesPresent,
} from './dashboardComposeService';
import {
  OWNER_CALL_FILE_DIRECTORY_NAME,
  OWNER_CALL_FILE_EXTENSION,
} from '../../../domain/usecases/intmux/OwnerCallFile';

export const DEFAULT_WEB_PORT = 9980;

export const CONSOLE_TOKEN_HEADER = 'x-pv-token';

export const CONSOLE_TOKEN_COOKIE = 'pv_token';

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
  '.yaml': 'text/yaml; charset=utf-8',
};

export const hasDotSegment = (requestPath: string): boolean =>
  requestPath
    .split('/')
    .some((segment) => segment.length > 0 && segment.startsWith('.'));

export const requiresToken = (requestPath: string): boolean =>
  requestPath.startsWith('/api/') ||
  requestPath === '/api' ||
  requestPath.endsWith('.json') ||
  requestPath.endsWith(OWNER_CALL_FILE_EXTENSION);

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
  return CONSOLE_LIST_TAB_NAMES.some((name) => name === tab);
};

export const isTokenValid = (
  expectedToken: string,
  providedToken: string | null,
): boolean => providedToken !== null && providedToken === expectedToken;

export const extractCookieToken = (
  cookieHeader: string | undefined,
): string | null => {
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
    return null;
  }
  for (const segment of cookieHeader.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const name = segment.slice(0, separatorIndex).trim();
    if (name !== CONSOLE_TOKEN_COOKIE) {
      continue;
    }
    const value = segment.slice(separatorIndex + 1).trim();
    if (value.length === 0) {
      return null;
    }
    return decodeURIComponent(value);
  }
  return null;
};

export const extractProvidedToken = (
  queryToken: string | string[] | null,
  headerToken: string | string[] | undefined,
  cookieToken: string | null,
): string | null => {
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  if (typeof headerToken === 'string' && headerToken.length > 0) {
    return headerToken;
  }
  if (cookieToken !== null && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
};

export const CONSOLE_TOKEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const buildTokenCookie = (token: string): string =>
  `${CONSOLE_TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${CONSOLE_TOKEN_COOKIE_MAX_AGE_SECONDS}`;

export const buildKeylessLocation = (requestUrl: URL): string => {
  const params = new URLSearchParams(requestUrl.searchParams);
  params.delete('k');
  const query = params.toString();
  return query.length > 0
    ? `${requestUrl.pathname}?${query}`
    : requestUrl.pathname;
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

export type WebServerOptions = {
  accessToken: string;
  uiDistDir: string;
  consoleDataOutputDir: string | null;
  inTmuxDataDir: string | null;
  dashboardDir: string | null;
  dashboardDataDir: string | null;
  dashboardProjectNames: string[];
  resolveGithubToken?: ConsoleGithubTokenResolver | null;
  imageFetcher?: ImageFetcher | null;
  issueRepository?: IssueRepository | null;
  resolveIssueRepository?: ConsoleIssueRepositoryResolver | null;
  resolveProject?: ConsoleProjectResolver | null;
  isPjcodeConfigured?: ConsolePjcodeValidator | null;
  resolveProjectRepository?: ConsoleProjectRepositoryResolver | null;
  issueAttachmentRepository?: IssueAttachmentRepository | null;
  projectRepository?: Pick<ProjectRepository, 'updateStoryList'> | null;
  issueTitleStateCache?: IssueTitleStateCache | null;
  pullRequestStatusCache?: PullRequestStatusCache | null;
};

const FLAT_IN_TMUX_PREFIX = '/in-tmux-by-human/';

const FLAT_IN_TMUX_FILE = /^[A-Za-z0-9._-]+\.json$/;

const NAME_SEGMENT = '[A-Za-z0-9_-][A-Za-z0-9._-]*';

const OWNER_CALL_FILE = new RegExp(
  `^${OWNER_CALL_FILE_DIRECTORY_NAME}/${NAME_SEGMENT}/${NAME_SEGMENT}${OWNER_CALL_FILE_EXTENSION.replace('.', '\\.')}$`,
);

export const DASHBOARD_REQUEST_PATH = '/tdpm.txt';

export const IMAGE_PROXY_REQUEST_PATH = '/api/img';

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

export const isOwnerCallFileRequestPath = (requestPath: string): boolean =>
  requestPath.startsWith(FLAT_IN_TMUX_PREFIX) &&
  OWNER_CALL_FILE.test(requestPath.slice(FLAT_IN_TMUX_PREFIX.length));

export const resolveFlatInTmuxFilePath = (
  inTmuxDataDir: string,
  requestPath: string,
): string | null => {
  if (!requestPath.startsWith(FLAT_IN_TMUX_PREFIX)) {
    return null;
  }
  const relativePath = requestPath.slice(FLAT_IN_TMUX_PREFIX.length);
  if (
    relativePath.length === 0 ||
    !(
      FLAT_IN_TMUX_FILE.test(relativePath) || OWNER_CALL_FILE.test(relativePath)
    )
  ) {
    return null;
  }
  const candidate = path.join(inTmuxDataDir, relativePath);
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
    'Referrer-Policy': 'no-referrer',
  });
  response.end(PLACEHOLDER_INDEX_HTML);
};

const serveIndexHtml = (
  options: WebServerOptions,
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
    'Referrer-Policy': 'no-referrer',
  });
  response.end(indexContent);
};

const redirectStrippingToken = (
  response: http.ServerResponse,
  requestUrl: URL,
  token: string,
): void => {
  response.writeHead(302, {
    Location: buildKeylessLocation(requestUrl),
    'Set-Cookie': buildTokenCookie(token),
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  response.end();
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

const sendImage = (
  response: http.ServerResponse,
  contentType: string,
  body: Buffer,
): void => {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': String(body.length),
    'Cache-Control': 'private, max-age=300',
  });
  response.end(body);
};

const handleImageProxy = async (
  options: WebServerOptions,
  response: http.ServerResponse,
  searchParams: URLSearchParams,
): Promise<void> => {
  const resolveGithubToken = options.resolveGithubToken ?? null;
  if (resolveGithubToken === null) {
    sendJson(response, 502, { error: 'github token is not configured' });
    return;
  }
  const itemUrl = searchParams.get('itemUrl') ?? '';
  const repositoryOwner = extractRepositoryOwner(itemUrl);
  if (repositoryOwner === null) {
    sendJson(response, 400, {
      error: 'missing or unreadable itemUrl parameter',
    });
    return;
  }
  const githubToken = resolveGithubToken(repositoryOwner);
  if (githubToken.length === 0) {
    sendJson(response, 502, { error: 'github token is not configured' });
    return;
  }
  const url = searchParams.get('url') ?? '';
  const result = await fetchProxiedImage(
    url,
    githubToken,
    options.imageFetcher ?? undefined,
  );
  if (!result.ok) {
    sendJson(response, result.statusCode, { error: result.error });
    return;
  }
  sendImage(response, result.contentType, result.body);
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
  options: WebServerOptions,
  requestPath: string,
  searchParams: URLSearchParams,
): Promise<{ statusCode: number; body: unknown } | null> => {
  if (requestPath === '/api/projects') {
    return {
      statusCode: 200,
      body: { pjcodes: options.dashboardProjectNames },
    };
  }
  const defaultIssueRepository = options.issueRepository ?? null;
  if (defaultIssueRepository === null) {
    return null;
  }
  const cache = options.issueTitleStateCache ?? null;
  const pullRequestStatusCache = options.pullRequestStatusCache ?? null;
  const url = searchParams.get('url');
  const issueRepository =
    url === null
      ? defaultIssueRepository
      : (options.resolveIssueRepository ?? (() => defaultIssueRepository))(url);
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
    case '/api/pullrequeststatus':
      if (pullRequestStatusCache === null) {
        return null;
      }
      return handlePullRequestStatus(
        issueRepository,
        pullRequestStatusCache,
        url,
      );
    default:
      return null;
  }
};

const operationErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
};

const dispatchOperation = (
  context: ConsoleOperationContext,
  requestPath: string,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: unknown }> | null => {
  switch (requestPath) {
    case '/api/review':
      return handleReview(context, body);
    case '/api/triage':
      return handleTriage(context, body);
    case '/api/intmux':
      return handleIntmux(context, body);
    case '/api/comment':
      return handleComment(context, body);
    case '/api/reviewcomment':
      return handleReviewComment(context, body);
    case '/api/upload':
      return handleAttachmentUpload(context, body);
    case '/api/createissue':
      return handleCreateIssue(context, body);
    case '/api/reorderstory':
      return handleReorderStory(context, body);
    case '/api/addstory':
      return handleAddStory(context, body);
    default:
      return null;
  }
};

const handleOperationApi = async (
  options: WebServerOptions,
  requestPath: string,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: unknown } | null> => {
  const issueRepository = options.issueRepository ?? null;
  const resolveProject = options.resolveProject ?? null;
  const isPjcodeConfigured = options.isPjcodeConfigured ?? null;
  if (
    issueRepository === null ||
    resolveProject === null ||
    isPjcodeConfigured === null
  ) {
    return null;
  }
  const resolveIssueRepository =
    options.resolveIssueRepository ?? ((): IssueRepository => issueRepository);
  const projectRepository = options.projectRepository ?? null;
  const context: ConsoleOperationContext = {
    resolveIssueRepository,
    resolveProject,
    isPjcodeConfigured,
    consoleDataOutputDir: options.consoleDataOutputDir,
    issueAttachmentRepository: options.issueAttachmentRepository ?? null,
    updateStoryList:
      projectRepository !== null
        ? (project, stories) =>
            projectRepository.updateStoryList(project, stories)
        : null,
    resolveProjectRepository: options.resolveProjectRepository ?? null,
  };
  const dispatched = dispatchOperation(context, requestPath, body);
  if (dispatched === null) {
    return null;
  }
  try {
    return await dispatched;
  } catch (error) {
    console.error('console operation failed', error);
    return {
      statusCode: 502,
      body: { error: operationErrorMessage(error) },
    };
  }
};

const serveFlatInTmuxFile = (
  options: WebServerOptions,
  response: http.ServerResponse,
  requestPath: string,
): void => {
  if (options.inTmuxDataDir === null) {
    sendNotFound(response);
    return;
  }
  const filePath = resolveFlatInTmuxFilePath(
    options.inTmuxDataDir,
    requestPath,
  );
  const content = filePath === null ? null : readStaticFile(filePath);
  if (filePath === null || content === null) {
    sendNotFound(response);
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentTypeForPath(filePath),
    'Cache-Control': 'no-store',
    'Content-Length': String(content.length),
  });
  response.end(content);
};

const removeOwnerCallFile = (
  options: WebServerOptions,
  response: http.ServerResponse,
  requestPath: string,
): void => {
  if (options.inTmuxDataDir === null) {
    sendNotFound(response);
    return;
  }
  const filePath = resolveFlatInTmuxFilePath(
    options.inTmuxDataDir,
    requestPath,
  );
  if (filePath === null) {
    sendNotFound(response);
    return;
  }
  fs.rmSync(filePath, { force: true });
  response.writeHead(204, {
    'Cache-Control': 'no-store',
  });
  response.end();
};

const handleTokenedRequest = async (
  options: WebServerOptions,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  requestPath: string,
  searchParams: URLSearchParams,
): Promise<void> => {
  const method = (request.method ?? 'GET').toUpperCase();

  if (requestPath.startsWith('/api/')) {
    if (method === 'GET') {
      if (requestPath === IMAGE_PROXY_REQUEST_PATH) {
        await handleImageProxy(options, response, searchParams);
        return;
      }
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

  if (requestPath.startsWith(FLAT_IN_TMUX_PREFIX)) {
    if (method === 'GET') {
      serveFlatInTmuxFile(options, response, requestPath);
      return;
    }
    if (method === 'DELETE' && isOwnerCallFileRequestPath(requestPath)) {
      removeOwnerCallFile(options, response, requestPath);
      return;
    }
    sendNotFound(response);
    return;
  }

  if (method === 'GET') {
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

const readStaticDashboardContent = (
  dashboardDir: string | null,
  requestPath: string,
): Buffer | null => {
  if (dashboardDir === null) {
    return null;
  }
  const dashboardFilePath = resolveDashboardFilePath(dashboardDir, requestPath);
  if (dashboardFilePath === null) {
    return null;
  }
  return readStaticFile(dashboardFilePath);
};

export const resolveDashboardContent = (
  options: WebServerOptions,
  requestPath: string,
): Buffer | null => {
  if (
    options.dashboardDataDir !== null &&
    dashboardComposeFilesPresent({
      dashboardDataDir: options.dashboardDataDir,
      projectNames: options.dashboardProjectNames,
    })
  ) {
    const dashboardText = composeDashboardText({
      dashboardDataDir: options.dashboardDataDir,
      projectNames: options.dashboardProjectNames,
    });
    return Buffer.from(dashboardText, 'utf-8');
  }
  return readStaticDashboardContent(options.dashboardDir, requestPath);
};

export const handleWebRequest = async (
  options: WebServerOptions,
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
    const dashboardContent = resolveDashboardContent(options, requestPath);
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
      extractCookieToken(request.headers.cookie),
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
    const queryToken = requestUrl.searchParams.get('k');
    if (queryToken !== null && queryToken.length > 0) {
      redirectStrippingToken(response, requestUrl, queryToken);
      return;
    }
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

export const createWebServer = (options: WebServerOptions): http.Server =>
  http.createServer((request, response) => {
    handleWebRequest(options, request, response).catch((error) => {
      console.error('console request failed', error);
      sendInternalServerError(response);
    });
  });

export type StartWebServerOptions = WebServerOptions & {
  port: number;
};

export const startWebServer = (
  options: StartWebServerOptions,
): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = createWebServer(options);
    server.once('error', reject);
    server.listen(options.port, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
