import http from 'http';
import fs from 'fs';
import path from 'path';
import { PrReviewViewerUseCaseInterface } from '../../../domain/usecases/PrReviewViewerServerStartUseCase';

export interface ImageProxyRepository {
  fetchImageProxy: (
    targetUrl: string,
  ) => Promise<{ content: Buffer; contentType: string }>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
};

const readBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const sendJson = (
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
};

const sendError = (
  res: http.ServerResponse,
  statusCode: number,
  message: string,
): void => {
  sendJson(res, statusCode, { ok: false, error: message });
};

const extractAccessKey = (req: http.IncomingMessage): string | null => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  const urlObj = new URL(req.url ?? '/', 'http://localhost');
  const queryKey = urlObj.searchParams.get('key');
  if (queryKey) {
    return queryKey;
  }
  return null;
};

export class PrReviewViewerHttpServer {
  private server: http.Server | null = null;

  constructor(
    private readonly useCase: PrReviewViewerUseCaseInterface,
    private readonly gitHubPrReviewRepository: ImageProxyRepository,
    private readonly accessKey: string,
    private readonly staticFilesDir: string,
  ) {}

  start = (host: string, port: number): Promise<void> =>
    new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });
      this.server.keepAliveTimeout = 0;
      this.server.on('error', reject);
      this.server.listen(port, host, () => {
        resolve();
      });
    });

  stop = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.closeAllConnections();
      this.server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  private handleRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const rawUrl = req.url ?? '/';
    const rawPath = rawUrl.split('?')[0];
    if (rawPath.split('/').some((seg) => seg === '..' || seg === '.')) {
      sendError(res, 400, 'Invalid path');
      return;
    }
    let urlObj: URL;
    try {
      urlObj = new URL(rawUrl, 'http://localhost');
    } catch {
      sendError(res, 400, 'Invalid request URL');
      return;
    }
    const pathname = urlObj.pathname;

    if (pathname.split('/').some((seg) => seg === '..' || seg === '.')) {
      sendError(res, 400, 'Invalid path');
      return;
    }

    if (pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    const key = extractAccessKey(req);
    if (!key || key !== this.accessKey) {
      sendError(res, 403, 'Unauthorized');
      return;
    }

    if (pathname === '/image-proxy') {
      await this.handleImageProxy(req, res, urlObj);
      return;
    }

    const blobMatch = pathname.match(/^\/blob\/([^/]+)\/([^/]+)\/(.+)$/);
    if (blobMatch) {
      const owner = blobMatch[1];
      const repo = blobMatch[2];
      const filePath = blobMatch[3];
      const ref = urlObj.searchParams.get('ref') ?? 'HEAD';
      const prHeadSha = urlObj.searchParams.get('prHeadSha') ?? ref;
      await this.handleBlob(res, owner, repo, filePath, ref, prHeadSha);
      return;
    }

    if (pathname === '/issue-title') {
      await this.handleIssueTitle(req, res, urlObj);
      return;
    }

    const listMatch = pathname.match(/^\/projects\/([^/]+)\/prs\/data\/list$/);
    if (listMatch && req.method === 'GET') {
      const projectCode = listMatch[1];
      await this.handleGetList(res, projectCode);
      return;
    }

    const detailMatch = pathname.match(
      /^\/projects\/([^/]+)\/prs\/data\/([^/]+)\/(\d+)$/,
    );
    if (detailMatch && req.method === 'GET') {
      const projectCode = detailMatch[1];
      const repoParam = detailMatch[2];
      const prNumber = parseInt(detailMatch[3], 10);
      await this.handleGetDetail(res, projectCode, repoParam, prNumber);
      return;
    }

    const reviewMatch = pathname.match(/^\/projects\/([^/]+)\/prs\/review$/);
    if (reviewMatch && req.method === 'POST') {
      const projectCode = reviewMatch[1];
      await this.handleReview(req, res, projectCode);
      return;
    }

    await this.serveStaticFile(req, res, pathname);
  };

  private handleGetList = async (
    res: http.ServerResponse,
    projectCode: string,
  ): Promise<void> => {
    try {
      const items = await this.useCase.getList(projectCode);
      sendJson(res, 200, items);
    } catch (_error) {
      void _error;
      sendError(res, 500, 'Internal server error');
    }
  };

  private handleGetDetail = async (
    res: http.ServerResponse,
    projectCode: string,
    repo: string,
    prNumber: number,
  ): Promise<void> => {
    try {
      const detail = await this.useCase.getDetail(projectCode, repo, prNumber);
      if (!detail) {
        sendError(res, 404, 'Not found');
        return;
      }
      sendJson(res, 200, detail);
    } catch (_error) {
      void _error;
      sendError(res, 500, 'Internal server error');
    }
  };

  private handleReview = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    projectCode: string,
  ): Promise<void> => {
    try {
      const bodyStr = await readBody(req);
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyStr);
      } catch {
        sendError(res, 400, 'Invalid JSON body');
        return;
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('action' in parsed) ||
        !('repo' in parsed) ||
        !('prNumber' in parsed) ||
        typeof parsed['action'] !== 'string' ||
        typeof parsed['repo'] !== 'string' ||
        typeof parsed['prNumber'] !== 'number'
      ) {
        sendError(res, 400, 'Missing required fields: action, repo, prNumber');
        return;
      }
      const action = parsed['action'];
      const repo = parsed['repo'];
      const prNumber = parsed['prNumber'];
      const projectItemId =
        'projectItemId' in parsed && typeof parsed['projectItemId'] === 'string'
          ? parsed['projectItemId']
          : '';
      const projectId =
        'projectId' in parsed && typeof parsed['projectId'] === 'string'
          ? parsed['projectId']
          : '';
      const statusFieldId =
        'statusFieldId' in parsed && typeof parsed['statusFieldId'] === 'string'
          ? parsed['statusFieldId']
          : '';
      const awaitingWorkspaceStatusOptionId =
        'awaitingWorkspaceStatusOptionId' in parsed &&
        typeof parsed['awaitingWorkspaceStatusOptionId'] === 'string'
          ? parsed['awaitingWorkspaceStatusOptionId']
          : '';
      const body =
        'body' in parsed && typeof parsed['body'] === 'string'
          ? parsed['body']
          : undefined;
      const isReviewComment = (
        c: unknown,
      ): c is { path: string; position: number; body: string } => {
        if (typeof c !== 'object' || c === null) {
          return false;
        }
        if (!('path' in c) || typeof c['path'] !== 'string') {
          return false;
        }
        if (!('position' in c) || typeof c['position'] !== 'number') {
          return false;
        }
        if (!('body' in c) || typeof c['body'] !== 'string') {
          return false;
        }
        return true;
      };
      const rawComments: unknown[] =
        'comments' in parsed && Array.isArray(parsed['comments'])
          ? parsed['comments']
          : [];
      const comments = rawComments.filter(isReviewComment);
      const validActions: string[] = [
        'APPROVE',
        'REQUEST_CHANGES',
        'COMMENT',
        'CLOSE_WRONG',
        'CLOSE_UNNEEDED',
      ];
      type ValidAction =
        | 'APPROVE'
        | 'REQUEST_CHANGES'
        | 'COMMENT'
        | 'CLOSE_WRONG'
        | 'CLOSE_UNNEEDED';
      const isValidAction = (a: string): a is ValidAction =>
        validActions.includes(a);
      if (!isValidAction(action)) {
        sendError(res, 400, `Invalid action: ${action}`);
        return;
      }
      const actionsRequiringProjectFields: ValidAction[] = [
        'APPROVE',
        'REQUEST_CHANGES',
      ];
      if (actionsRequiringProjectFields.includes(action)) {
        if (
          !projectItemId ||
          !projectId ||
          !statusFieldId ||
          !awaitingWorkspaceStatusOptionId
        ) {
          sendError(
            res,
            400,
            'Missing required fields for this action: projectItemId, projectId, statusFieldId, awaitingWorkspaceStatusOptionId',
          );
          return;
        }
      }
      const result = await this.useCase.executeReview(projectCode, {
        action,
        repo,
        prNumber,
        projectItemId,
        projectId,
        statusFieldId,
        awaitingWorkspaceStatusOptionId,
        body,
        comments,
      });
      if (result.ok) {
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 400, { ok: false, error: result.error });
      }
    } catch (_error) {
      void _error;
      sendJson(res, 500, { ok: false, error: 'Internal server error' });
    }
  };

  private handleImageProxy = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    urlObj: URL,
  ): Promise<void> => {
    try {
      const targetUrl = urlObj.searchParams.get('url');
      if (!targetUrl) {
        sendError(res, 400, 'Missing url parameter');
        return;
      }
      let decodedUrl: string;
      try {
        decodedUrl = decodeURIComponent(targetUrl);
      } catch {
        sendError(res, 400, 'Invalid url encoding');
        return;
      }
      let parsedTarget: URL;
      try {
        parsedTarget = new URL(decodedUrl);
      } catch {
        sendError(res, 400, 'Invalid target URL');
        return;
      }
      const allowedHostnames = [
        'private-user-images.githubusercontent.com',
        'user-images.githubusercontent.com',
        'github.com',
      ];
      if (!allowedHostnames.includes(parsedTarget.hostname)) {
        sendError(res, 400, `Hostname not allowed: ${parsedTarget.hostname}`);
        return;
      }
      const { content, contentType } =
        await this.gitHubPrReviewRepository.fetchImageProxy(decodedUrl);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
      });
      res.end(content);
    } catch (_error) {
      void _error;
      sendError(res, 500, 'Internal server error');
    }
  };

  private handleBlob = async (
    res: http.ServerResponse,
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    prHeadSha: string,
  ): Promise<void> => {
    try {
      const { content, contentType } = await this.useCase.getFileContent(
        owner,
        repo,
        filePath,
        ref,
        prHeadSha,
      );
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
      });
      res.end(content);
    } catch (_error) {
      void _error;
      sendError(res, 500, 'Internal server error');
    }
  };

  private handleIssueTitle = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    urlObj: URL,
  ): Promise<void> => {
    try {
      const owner = urlObj.searchParams.get('owner');
      const repo = urlObj.searchParams.get('repo');
      const numberStr = urlObj.searchParams.get('number');
      if (!owner || !repo || !numberStr) {
        sendError(res, 400, 'Missing required parameters: owner, repo, number');
        return;
      }
      const number = parseInt(numberStr, 10);
      if (isNaN(number)) {
        sendError(res, 400, 'Invalid number parameter');
        return;
      }
      const info = await this.useCase.getIssueTitleInfo(owner, repo, number);
      sendJson(res, 200, info);
    } catch (_error) {
      void _error;
      sendError(res, 500, 'Internal server error');
    }
  };

  private serveStaticFile = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<void> => {
    const normalizedPath = pathname === '/' ? '/index.html' : pathname;
    const relativePath = normalizedPath.startsWith('/')
      ? normalizedPath.slice(1)
      : normalizedPath;
    const resolvedBase = path.resolve(this.staticFilesDir);
    const resolvedFile = path.resolve(this.staticFilesDir, relativePath);
    if (
      !resolvedFile.startsWith(resolvedBase + path.sep) &&
      resolvedFile !== resolvedBase
    ) {
      sendError(res, 400, 'Invalid path');
      return;
    }
    if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
      const indexPath = path.join(resolvedBase, 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolvedFile).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    const content = fs.readFileSync(resolvedFile);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
    });
    res.end(content);
  };
}
