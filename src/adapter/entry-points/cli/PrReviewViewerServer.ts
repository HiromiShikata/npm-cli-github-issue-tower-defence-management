import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

const isJsonObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const GITHUB_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'avatars.githubusercontent.com',
  'camo.githubusercontent.com',
  'user-images.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'objects.githubusercontent.com',
]);

const SAFE_GITHUB_SEGMENT = /^[a-zA-Z0-9._-]+$/;

const isSafeGithubSegment = (segment: string): boolean =>
  SAFE_GITHUB_SEGMENT.test(segment) && !segment.includes('..');

type DoneStore = {
  done: string[];
};

type ReviewActionPayload = {
  action: string;
  repo: string;
  prNumber: number;
  projectItemId: string;
  inlineComments: InlineComment[];
};

type InlineComment = {
  filename: string;
  line: number;
  body: string;
};

type RefResolutionCache = Map<string, RefResolution>;

type RefResolution = {
  title: string;
  state: string;
  isPR: boolean;
  url: string;
};

type GithubPrReview = {
  event: string;
  body: string;
  comments: { path: string; position: number; body: string }[];
};

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const CHORE_ROUTING_LABEL = 'chore';

const VALID_ACTIONS = new Set([
  'APPROVE',
  'REQUEST_CHANGES',
  'COMMENT',
  'CLOSE_WRONG',
  'CLOSE_UNNEEDED',
]);

const sendJson = (
  res: http.ServerResponse,
  status: number,
  data: unknown,
): void => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
};

const sendError = (
  res: http.ServerResponse,
  status: number,
  message: string,
): void => {
  sendJson(res, status, { ok: false, error: message });
};

const validateAccessKey = (
  req: http.IncomingMessage,
  expectedKey: string,
): boolean => {
  const headerKey = req.headers['x-access-key'];
  if (typeof headerKey === 'string' && headerKey === expectedKey) return true;
  const parsedUrl = url.parse(req.url ?? '', true);
  return parsedUrl.query['accessKey'] === expectedKey;
};

const readBodyJson = (req: http.IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = chunks.map((c) => Buffer.from(c).toString()).join('');
        resolve(JSON.parse(bodyStr));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });

const isReviewActionPayload = (body: unknown): body is ReviewActionPayload =>
  isJsonObject(body) &&
  typeof body['action'] === 'string' &&
  typeof body['repo'] === 'string' &&
  typeof body['prNumber'] === 'number' &&
  typeof body['projectItemId'] === 'string' &&
  Array.isArray(body['inlineComments']);

const parseDoneStore = (raw: unknown): DoneStore => {
  if (!isJsonObject(raw)) return { done: [] };
  const doneVal = raw['done'];
  const done = Array.isArray(doneVal)
    ? doneVal.filter((v): v is string => typeof v === 'string')
    : [];
  return { done };
};

const loadDoneStore = (doneFilePath: string): DoneStore => {
  if (!fs.existsSync(doneFilePath)) return { done: [] };
  try {
    return parseDoneStore(JSON.parse(fs.readFileSync(doneFilePath, 'utf8')));
  } catch {
    return { done: [] };
  }
};

const saveDoneStore = (doneFilePath: string, store: DoneStore): void => {
  fs.mkdirSync(path.dirname(doneFilePath), { recursive: true });
  fs.writeFileSync(doneFilePath, JSON.stringify(store));
};

const buildDoneFilePath = (dataDir: string, projectCode: string): string =>
  path.join(dataDir, projectCode, 'done.json');

const buildListFilePath = (dataDir: string, projectCode: string): string =>
  path.join(dataDir, projectCode, 'list.json');

const buildDetailFilePath = (
  dataDir: string,
  projectCode: string,
  repo: string,
  prNumber: number,
): string =>
  path.join(
    dataDir,
    projectCode,
    'details',
    repo.replace('/', '_'),
    `${prNumber}.json`,
  );

type GithubApiErrorResponse = { message?: string };

const isGithubApiErrorResponse = (
  data: unknown,
): data is GithubApiErrorResponse =>
  isJsonObject(data) &&
  ('message' in data ? typeof data['message'] === 'string' : true);

const buildGithubApiUrl = (apiPath: string): string => {
  const segments = apiPath.split('/').filter((s) => s.length > 0);
  const encodedPath = segments.map(encodeURIComponent).join('/');
  return `https://api.github.com/${encodedPath}`;
};

const githubApiRequest = async (
  ghToken: string,
  method: string,
  apiPath: string,
  body: unknown,
): Promise<unknown> => {
  const response = await fetch(buildGithubApiUrl(apiPath), {
    method,
    headers: {
      Authorization: `Bearer ${ghToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data: unknown = JSON.parse(text);
  if (!response.ok) {
    const errorMessage = isGithubApiErrorResponse(data)
      ? (data.message ?? `GitHub API error ${response.status}`)
      : `GitHub API error ${response.status}`;
    throw new Error(errorMessage);
  }
  return data;
};

type GithubGraphqlResponse = { errors?: JsonValue[]; data?: JsonValue };

const isGithubGraphqlResponse = (
  value: unknown,
): value is GithubGraphqlResponse => isJsonObject(value);

const githubGraphql = async (
  ghToken: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> => {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  const parsed: unknown = JSON.parse(text);
  if (!isGithubGraphqlResponse(parsed)) {
    throw new Error('GitHub GraphQL: unexpected response format');
  }
  if (!response.ok || parsed.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(parsed.errors)}`);
  }
  return parsed.data;
};

const setProjectItemStatus = async (
  ghToken: string,
  projectItemId: string,
  statusValue: string,
): Promise<void> => {
  const projectId = projectItemId.split('_')[1];
  if (!projectId) return;

  const query = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }
  `;
  await githubGraphql(ghToken, query, {
    projectId,
    itemId: projectItemId,
    fieldId: 'STATUS_FIELD_ID',
    optionId: statusValue,
  }).catch(() => undefined);
};

const executeApprove = async (
  ghToken: string,
  repo: string,
  prNumber: number,
  projectItemId: string,
  inlineComments: InlineComment[],
): Promise<void> => {
  const [owner, repoName] = repo.split('/');
  const reviewBody: GithubPrReview = {
    event: 'APPROVE',
    body: '',
    comments: inlineComments.map((c) => ({
      path: c.filename,
      position: c.line,
      body: c.body,
    })),
  };
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
    reviewBody,
  );
  await setProjectItemStatus(
    ghToken,
    projectItemId,
    'awaiting-workspace',
  ).catch(() => undefined);
};

const executeRequestChanges = async (
  ghToken: string,
  repo: string,
  prNumber: number,
  projectItemId: string,
  inlineComments: InlineComment[],
): Promise<void> => {
  const [owner, repoName] = repo.split('/');
  const reviewBody: GithubPrReview = {
    event: 'REQUEST_CHANGES',
    body: '',
    comments: inlineComments.map((c) => ({
      path: c.filename,
      position: c.line,
      body: c.body,
    })),
  };
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
    reviewBody,
  );
  await setProjectItemStatus(
    ghToken,
    projectItemId,
    'awaiting-workspace',
  ).catch(() => undefined);
};

const executeComment = async (
  ghToken: string,
  repo: string,
  prNumber: number,
  inlineComments: InlineComment[],
): Promise<void> => {
  const [owner, repoName] = repo.split('/');
  const reviewBody: GithubPrReview = {
    event: 'COMMENT',
    body: '',
    comments: inlineComments.map((c) => ({
      path: c.filename,
      position: c.line,
      body: c.body,
    })),
  };
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
    reviewBody,
  );
};

const executeCloseWrong = async (
  ghToken: string,
  repo: string,
  prNumber: number,
): Promise<void> => {
  const [owner, repoName] = repo.split('/');
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/issues/${prNumber}/comments`,
    {
      body: 'totally wrong',
    },
  );
  await githubApiRequest(
    ghToken,
    'PATCH',
    `/repos/${owner}/${repoName}/pulls/${prNumber}`,
    {
      state: 'closed',
    },
  );
};

const executeCloseUnneeded = async (
  ghToken: string,
  repo: string,
  prNumber: number,
  linkedIssueNumber: number,
): Promise<void> => {
  const [owner, repoName] = repo.split('/');
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/issues/${prNumber}/comments`,
    {
      body: 'This pull request is unnecessary.',
    },
  );
  await githubApiRequest(
    ghToken,
    'POST',
    `/repos/${owner}/${repoName}/issues/${linkedIssueNumber}/labels`,
    {
      labels: [CHORE_ROUTING_LABEL],
    },
  );
  await githubApiRequest(
    ghToken,
    'PATCH',
    `/repos/${owner}/${repoName}/pulls/${prNumber}`,
    {
      state: 'closed',
    },
  );
};

const serveStaticFile = (
  res: http.ServerResponse,
  staticDir: string,
  filePath: string,
): void => {
  const resolvedBase = path.resolve(staticDir);
  const normalized = path.normalize(filePath.replace(/^\//, ''));
  if (normalized.startsWith('..') || normalized.includes(path.sep + '..')) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const safePath = path.join(resolvedBase, normalized);
  if (
    !safePath.startsWith(resolvedBase + path.sep) &&
    safePath !== resolvedBase
  ) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    const indexPath = path.join(resolvedBase, 'index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Referrer-Policy': 'no-referrer',
      });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
    return;
  }
  const ext = path.extname(safePath);
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const headers: Record<string, string> = { 'Content-Type': mimeType };
  if (filePath.endsWith('.html') || filePath === '/') {
    headers['Referrer-Policy'] = 'no-referrer';
  }
  res.writeHead(200, headers);
  res.end(fs.readFileSync(safePath));
};

export type PrReviewViewerServerOptions = {
  accessKey: string;
  staticDir: string;
  dataDir: string;
  host: string;
  port: number;
  ghToken: string;
};

export const createPrReviewViewerServer = (
  options: PrReviewViewerServerOptions,
): http.Server => {
  const { accessKey, staticDir, dataDir, ghToken } = options;
  const refCache: RefResolutionCache = new Map();

  const handleRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const parsedUrl = url.parse(req.url ?? '/', true);
    const pathname = parsedUrl.pathname ?? '/';
    const method = req.method ?? 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Key');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const projectMatch = pathname.match(/^\/projects\/([^/]+)\/prs(\/.*)?$/);

    if (pathname.startsWith('/image-proxy')) {
      if (!validateAccessKey(req, accessKey)) {
        sendError(res, 403, 'Unauthorized');
        return;
      }
      const imageUrl = parsedUrl.query['url'];
      if (typeof imageUrl !== 'string') {
        sendError(res, 400, 'Missing url parameter');
        return;
      }
      let safeImageUrl: URL;
      try {
        safeImageUrl = new URL(imageUrl);
      } catch {
        sendError(res, 400, 'Invalid URL');
        return;
      }
      const allowedHost = [...GITHUB_HOSTS].find(
        (h) => h === safeImageUrl.hostname,
      );
      if (safeImageUrl.protocol !== 'https:' || allowedHost === undefined) {
        sendError(res, 400, 'Only GitHub URLs are allowed');
        return;
      }
      const safeImageFetchUrl = new URL(
        safeImageUrl.pathname + safeImageUrl.search,
        `https://${allowedHost}`,
      );
      try {
        const imageResponse = await fetch(safeImageFetchUrl.toString(), {
          headers: { Authorization: `Bearer ${ghToken}` },
        });
        res.writeHead(imageResponse.status, {
          'Content-Type':
            imageResponse.headers.get('Content-Type') ?? 'image/jpeg',
        });
        const buffer = await imageResponse.arrayBuffer();
        res.end(Buffer.from(buffer));
      } catch (err) {
        console.error(
          'Internal server error:',
          err instanceof Error ? err.message : String(err),
        );
        sendError(res, 500, 'Internal server error');
      }
      return;
    }

    if (pathname.startsWith('/api/resolve-ref')) {
      if (!validateAccessKey(req, accessKey)) {
        sendError(res, 403, 'Unauthorized');
        return;
      }
      const owner = parsedUrl.query['owner'];
      const repo = parsedUrl.query['repo'];
      const numberStr = parsedUrl.query['number'];
      if (
        typeof owner !== 'string' ||
        typeof repo !== 'string' ||
        typeof numberStr !== 'string'
      ) {
        sendError(res, 400, 'Missing parameters');
        return;
      }
      if (
        !isSafeGithubSegment(owner) ||
        !isSafeGithubSegment(repo) ||
        !/^\d+$/.test(numberStr)
      ) {
        sendError(res, 400, 'Invalid parameters');
        return;
      }
      const cacheKey = `${owner}/${repo}/${numberStr}`;
      const cached = refCache.get(cacheKey);
      if (cached) {
        sendJson(res, 200, cached);
        return;
      }
      try {
        const issueRaw = await githubApiRequest(
          ghToken,
          'GET',
          `/repos/${owner}/${repo}/issues/${numberStr}`,
          undefined,
        );
        const issueObj: JsonObject = isJsonObject(issueRaw) ? issueRaw : {};
        const resolution: RefResolution = {
          title: typeof issueObj['title'] === 'string' ? issueObj['title'] : '',
          state: typeof issueObj['state'] === 'string' ? issueObj['state'] : '',
          isPR:
            'pull_request' in issueObj &&
            issueObj['pull_request'] !== null &&
            issueObj['pull_request'] !== undefined,
          url:
            typeof issueObj['html_url'] === 'string'
              ? issueObj['html_url']
              : '',
        };
        refCache.set(cacheKey, resolution);
        sendJson(res, 200, resolution);
      } catch (err) {
        console.error(
          'Internal server error:',
          err instanceof Error ? err.message : String(err),
        );
        sendError(res, 500, 'Internal server error');
      }
      return;
    }

    if (!projectMatch) {
      serveStaticFile(res, staticDir, pathname);
      return;
    }

    const projectCode = projectMatch[1];
    const subPath = projectMatch[2] ?? '/';

    const blobMatch = subPath.match(
      /^\/blob\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
    );
    if (blobMatch) {
      if (!validateAccessKey(req, accessKey)) {
        sendError(res, 403, 'Unauthorized');
        return;
      }
      const [, owner, repo, ref, filePath] = blobMatch;
      if (
        !isSafeGithubSegment(owner) ||
        !isSafeGithubSegment(repo) ||
        !isSafeGithubSegment(ref)
      ) {
        sendError(res, 400, 'Invalid parameters');
        return;
      }
      const safeFilePath = filePath
        .split('/')
        .every((seg) => isSafeGithubSegment(seg) || seg === '')
        ? filePath
        : null;
      if (!safeFilePath) {
        sendError(res, 400, 'Invalid file path');
        return;
      }
      try {
        const encodedOwner = encodeURIComponent(owner);
        const encodedRepo = encodeURIComponent(repo);
        const encodedRef = encodeURIComponent(ref);
        const encodedFilePath = safeFilePath
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        const rawUrl = new URL(
          `/${encodedOwner}/${encodedRepo}/${encodedRef}/${encodedFilePath}`,
          'https://raw.githubusercontent.com',
        );
        const rawResponse = await fetch(rawUrl.toString(), {
          headers: { Authorization: `Bearer ${ghToken}` },
        });
        if (!rawResponse.ok) {
          sendError(res, rawResponse.status, 'File not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type':
            rawResponse.headers.get('Content-Type') ??
            'application/octet-stream',
        });
        const buffer = await rawResponse.arrayBuffer();
        res.end(Buffer.from(buffer));
      } catch (err) {
        console.error(
          'Internal server error:',
          err instanceof Error ? err.message : String(err),
        );
        sendError(res, 500, 'Internal server error');
      }
      return;
    }

    if (!validateAccessKey(req, accessKey)) {
      if (
        subPath === '/' ||
        subPath === '' ||
        (!subPath.startsWith('/data') && !subPath.startsWith('/review'))
      ) {
        const indexPath = path.join(staticDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          const content = fs.readFileSync(indexPath);
          res.writeHead(200, {
            'Content-Type': 'text/html',
            'Referrer-Policy': 'no-referrer',
          });
          res.end(content);
        } else {
          sendError(res, 403, 'Unauthorized');
        }
        return;
      }
      sendError(res, 403, 'Unauthorized');
      return;
    }

    if (subPath === '/data/list' && method === 'GET') {
      const listPath = buildListFilePath(dataDir, projectCode);
      if (!fs.existsSync(listPath)) {
        sendJson(res, 200, { stories: [], items: [] });
        return;
      }
      const rawListParsed: unknown = JSON.parse(
        fs.readFileSync(listPath, 'utf8'),
      );
      const rawListObj: JsonObject = isJsonObject(rawListParsed)
        ? rawListParsed
        : {};
      const rawItems: JsonValue[] = Array.isArray(rawListObj['items'])
        ? rawListObj['items']
        : [];
      const rawStories: JsonValue[] = Array.isArray(rawListObj['stories'])
        ? rawListObj['stories']
        : [];
      const doneStore = loadDoneStore(buildDoneFilePath(dataDir, projectCode));
      const doneSet = new Set(doneStore.done);
      const filteredItems = rawItems.filter((item) => {
        if (!isJsonObject(item)) return true;
        const prField = item['pr'];
        if (!isJsonObject(prField)) return true;
        const key = `${String(prField['repo'])}/${String(prField['number'])}`;
        return !doneSet.has(key);
      });
      sendJson(res, 200, { stories: rawStories, items: filteredItems });
      return;
    }

    const detailMatch = subPath.match(/^\/data\/([^/]+\/[^/]+)\/(\d+)$/);
    if (detailMatch && method === 'GET') {
      const repo = detailMatch[1];
      const prNumber = Number(detailMatch[2]);
      const detailPath = buildDetailFilePath(
        dataDir,
        projectCode,
        repo,
        prNumber,
      );
      if (!fs.existsSync(detailPath)) {
        sendError(res, 404, 'Detail not found');
        return;
      }
      const content = fs.readFileSync(detailPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
      return;
    }

    if (subPath === '/review' && method === 'POST') {
      let body: unknown;
      try {
        body = await readBodyJson(req);
      } catch {
        sendError(res, 400, 'Invalid JSON');
        return;
      }

      if (!isReviewActionPayload(body)) {
        sendError(res, 400, 'Invalid request body');
        return;
      }

      if (!VALID_ACTIONS.has(body.action)) {
        sendError(res, 400, 'Invalid action');
        return;
      }

      try {
        switch (body.action) {
          case 'APPROVE':
            await executeApprove(
              ghToken,
              body.repo,
              body.prNumber,
              body.projectItemId,
              body.inlineComments,
            );
            break;
          case 'REQUEST_CHANGES':
            await executeRequestChanges(
              ghToken,
              body.repo,
              body.prNumber,
              body.projectItemId,
              body.inlineComments,
            );
            break;
          case 'COMMENT':
            await executeComment(
              ghToken,
              body.repo,
              body.prNumber,
              body.inlineComments,
            );
            break;
          case 'CLOSE_WRONG':
            await executeCloseWrong(ghToken, body.repo, body.prNumber);
            break;
          case 'CLOSE_UNNEEDED': {
            const detailPath = buildDetailFilePath(
              dataDir,
              projectCode,
              body.repo,
              body.prNumber,
            );
            let linkedIssueNumber = 0;
            if (fs.existsSync(detailPath)) {
              const detailParsed: unknown = JSON.parse(
                fs.readFileSync(detailPath, 'utf8'),
              );
              if (isJsonObject(detailParsed)) {
                const issueField = detailParsed['issue'];
                if (
                  isJsonObject(issueField) &&
                  typeof issueField['number'] === 'number'
                ) {
                  linkedIssueNumber = issueField['number'];
                }
              }
            }
            await executeCloseUnneeded(
              ghToken,
              body.repo,
              body.prNumber,
              linkedIssueNumber,
            );
            break;
          }
          default:
            sendError(res, 400, 'Unknown action');
            return;
        }

        if (
          body.action === 'APPROVE' ||
          body.action === 'REQUEST_CHANGES' ||
          body.action === 'CLOSE_WRONG' ||
          body.action === 'CLOSE_UNNEEDED'
        ) {
          const doneFilePath = buildDoneFilePath(dataDir, projectCode);
          const doneStore = loadDoneStore(doneFilePath);
          const key = `${body.repo}/${body.prNumber}`;
          if (!doneStore.done.includes(key)) {
            doneStore.done.push(key);
            saveDoneStore(doneFilePath, doneStore);
          }
        }

        sendJson(res, 200, { ok: true });
      } catch (err) {
        console.error(
          'Review action error:',
          err instanceof Error ? err.message : String(err),
        );
        sendError(res, 422, 'Review action failed');
      }
      return;
    }

    if (!subPath.startsWith('/data') && !subPath.startsWith('/review')) {
      serveStaticFile(res, staticDir, pathname);
      return;
    }

    sendError(res, 404, 'Not Found');
  };

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error(
        'Unhandled request error:',
        err instanceof Error ? err.message : String(err),
      );
      sendError(res, 500, 'Internal server error');
    });
  });

  return server;
};

export const startPrReviewViewerServer = (
  options: PrReviewViewerServerOptions,
): Promise<void> =>
  new Promise((resolve) => {
    const server = createPrReviewViewerServer(options);

    const shutdown = (): void => {
      server.close(() => resolve());
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    server.listen(options.port, options.host, () => {
      console.log(
        `PR Review Viewer running at http://${options.host}:${options.port}`,
      );
    });
  });
