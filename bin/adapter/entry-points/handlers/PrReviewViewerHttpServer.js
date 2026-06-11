"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrReviewViewerHttpServer = void 0;
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MIME_TYPES = {
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
const readBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
});
const sendJson = (res, statusCode, body) => {
    const json = JSON.stringify(body);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
};
const sendError = (res, statusCode, message) => {
    sendJson(res, statusCode, { ok: false, error: message });
};
const extractAccessKey = (req) => {
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
class PrReviewViewerHttpServer {
    constructor(useCase, gitHubPrReviewRepository, accessKey, staticFilesDir) {
        this.useCase = useCase;
        this.gitHubPrReviewRepository = gitHubPrReviewRepository;
        this.accessKey = accessKey;
        this.staticFilesDir = staticFilesDir;
        this.server = null;
        this.start = (host, port) => new Promise((resolve, reject) => {
            this.server = http_1.default.createServer(this.handleRequest);
            this.server.on('error', reject);
            this.server.listen(port, host, () => {
                console.log(`PR review viewer server listening on http://${host}:${port}`);
                resolve();
            });
        });
        this.stop = () => new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        this.handleRequest = async (req, res) => {
            const rawUrl = req.url ?? '/';
            const urlObj = new URL(rawUrl, 'http://localhost');
            const pathname = urlObj.pathname;
            if (pathname === '/health') {
                sendJson(res, 200, { ok: true });
                return;
            }
            const apiPatterns = [
                /^\/projects\/[^/]+\/prs\/data\/list$/,
                /^\/projects\/[^/]+\/prs\/data\/.+\/\d+$/,
                /^\/projects\/[^/]+\/prs\/review$/,
                /^\/image-proxy$/,
                /^\/blob\//,
                /^\/issue-title$/,
            ];
            const isApiRequest = apiPatterns.some((p) => p.test(pathname));
            if (isApiRequest) {
                const key = extractAccessKey(req);
                if (!key || key !== this.accessKey) {
                    sendError(res, 403, 'Unauthorized');
                    return;
                }
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
            const detailMatch = pathname.match(/^\/projects\/([^/]+)\/prs\/data\/([^/]+)\/(\d+)$/);
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
        this.handleGetList = async (res, projectCode) => {
            try {
                const items = await this.useCase.getList(projectCode);
                sendJson(res, 200, items);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendError(res, 400, message);
            }
        };
        this.handleGetDetail = async (res, projectCode, repo, prNumber) => {
            try {
                const detail = await this.useCase.getDetail(projectCode, repo, prNumber);
                if (!detail) {
                    sendError(res, 404, 'Not found');
                    return;
                }
                sendJson(res, 200, detail);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendError(res, 400, message);
            }
        };
        this.handleReview = async (req, res, projectCode) => {
            try {
                const bodyStr = await readBody(req);
                let parsed;
                try {
                    parsed = JSON.parse(bodyStr);
                }
                catch {
                    sendError(res, 400, 'Invalid JSON body');
                    return;
                }
                if (typeof parsed !== 'object' ||
                    parsed === null ||
                    !('action' in parsed) ||
                    !('repo' in parsed) ||
                    !('prNumber' in parsed)) {
                    sendError(res, 400, 'Missing required fields: action, repo, prNumber');
                    return;
                }
                const request = parsed;
                const validActions = [
                    'APPROVE',
                    'REQUEST_CHANGES',
                    'COMMENT',
                    'CLOSE_WRONG',
                    'CLOSE_UNNEEDED',
                ];
                if (!validActions.includes(request.action)) {
                    sendError(res, 400, `Invalid action: ${request.action}`);
                    return;
                }
                const result = await this.useCase.executeReview(projectCode, {
                    action: request.action,
                    repo: request.repo,
                    prNumber: request.prNumber,
                    projectItemId: request.projectItemId ?? '',
                    projectId: request.projectId ?? '',
                    statusFieldId: request.statusFieldId ?? '',
                    awaitingWorkspaceStatusOptionId: request.awaitingWorkspaceStatusOptionId ?? '',
                    body: request.body,
                    comments: request.comments,
                });
                if (result.ok) {
                    sendJson(res, 200, { ok: true });
                }
                else {
                    sendJson(res, 400, { ok: false, error: result.error });
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendJson(res, 400, { ok: false, error: message });
            }
        };
        this.handleImageProxy = async (req, res, urlObj) => {
            try {
                const targetUrl = urlObj.searchParams.get('url');
                if (!targetUrl) {
                    sendError(res, 400, 'Missing url parameter');
                    return;
                }
                let decodedUrl;
                try {
                    decodedUrl = decodeURIComponent(targetUrl);
                }
                catch {
                    sendError(res, 400, 'Invalid url encoding');
                    return;
                }
                let parsedTarget;
                try {
                    parsedTarget = new URL(decodedUrl);
                }
                catch {
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
                const { content, contentType } = await this.gitHubPrReviewRepository.fetchImageProxy(decodedUrl);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': content.length,
                });
                res.end(content);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendError(res, 400, message);
            }
        };
        this.handleBlob = async (res, owner, repo, filePath, ref, prHeadSha) => {
            try {
                const { content, contentType } = await this.useCase.getFileContent(owner, repo, filePath, ref, prHeadSha);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': content.length,
                });
                res.end(content);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendError(res, 400, message);
            }
        };
        this.handleIssueTitle = async (req, res, urlObj) => {
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
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                sendError(res, 400, message);
            }
        };
        this.serveStaticFile = async (req, res, pathname) => {
            if (pathname.includes('..')) {
                sendError(res, 400, 'Invalid path');
                return;
            }
            const normalizedPath = pathname === '/' ? '/index.html' : pathname;
            const filePath = path_1.default.join(this.staticFilesDir, normalizedPath);
            if (!fs_1.default.existsSync(filePath) || !fs_1.default.statSync(filePath).isFile()) {
                const indexPath = path_1.default.join(this.staticFilesDir, 'index.html');
                if (fs_1.default.existsSync(indexPath)) {
                    const content = fs_1.default.readFileSync(indexPath);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(content);
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            const ext = path_1.default.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
            const content = fs_1.default.readFileSync(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': content.length,
            });
            res.end(content);
        };
    }
}
exports.PrReviewViewerHttpServer = PrReviewViewerHttpServer;
//# sourceMappingURL=PrReviewViewerHttpServer.js.map