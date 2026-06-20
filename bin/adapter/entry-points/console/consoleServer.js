"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startConsoleServer = exports.createConsoleServer = exports.handleConsoleRequest = exports.extractProvidedToken = exports.isTokenValid = exports.isConsoleAppRoute = exports.requiresToken = exports.hasDotSegment = exports.CONSOLE_TOKEN_HEADER = exports.DEFAULT_CONSOLE_PORT = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const consoleDataDelivery_1 = require("./consoleDataDelivery");
const consoleReadApi_1 = require("./consoleReadApi");
const consoleOperationApi_1 = require("./consoleOperationApi");
exports.DEFAULT_CONSOLE_PORT = 9981;
exports.CONSOLE_TOKEN_HEADER = 'x-pv-token';
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
const MIME_TYPES = {
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
const hasDotSegment = (requestPath) => requestPath
    .split('/')
    .some((segment) => segment.length > 0 && segment.startsWith('.'));
exports.hasDotSegment = hasDotSegment;
const requiresToken = (requestPath) => requestPath.startsWith('/api/') ||
    requestPath === '/api' ||
    requestPath.endsWith('.json');
exports.requiresToken = requiresToken;
const SAFE_PJCODE = /^[A-Za-z0-9._-]+$/;
const isConsoleAppRoute = (requestPath) => {
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
    return consoleDataDelivery_1.CONSOLE_LIST_TAB_NAMES.includes(tab);
};
exports.isConsoleAppRoute = isConsoleAppRoute;
const isTokenValid = (expectedToken, providedToken) => providedToken !== null && providedToken === expectedToken;
exports.isTokenValid = isTokenValid;
const extractProvidedToken = (queryToken, headerToken) => {
    if (typeof queryToken === 'string' && queryToken.length > 0) {
        return queryToken;
    }
    if (typeof headerToken === 'string' && headerToken.length > 0) {
        return headerToken;
    }
    return null;
};
exports.extractProvidedToken = extractProvidedToken;
const contentTypeForPath = (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    return MIME_TYPES[extension] ?? 'application/octet-stream';
};
const resolveStaticFilePath = (uiDistDir, requestPath) => {
    const relativePath = requestPath === '/' ? '/index.html' : requestPath;
    const normalized = path
        .normalize(relativePath)
        .replace(/^(\.\.(\/|\\|$))+/, '');
    const candidate = path.join(uiDistDir, normalized);
    const resolvedRoot = path.resolve(uiDistDir);
    const resolvedCandidate = path.resolve(candidate);
    if (resolvedCandidate !== resolvedRoot &&
        !resolvedCandidate.startsWith(resolvedRoot + path.sep)) {
        return null;
    }
    return resolvedCandidate;
};
const readStaticFile = (filePath) => {
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            return null;
        }
        return fs.readFileSync(filePath);
    }
    catch {
        return null;
    }
};
const sendNotFound = (response) => {
    response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end('Not Found');
};
const sendUnauthorized = (response) => {
    response.writeHead(401, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end('Unauthorized');
};
const serveBootstrapIndex = (response) => {
    response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(PLACEHOLDER_INDEX_HTML);
};
const serveIndexHtml = (options, response) => {
    const indexFilePath = resolveStaticFilePath(options.uiDistDir, '/index.html');
    const indexContent = indexFilePath === null ? null : readStaticFile(indexFilePath);
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
const sendJson = (response, statusCode, body) => {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(body));
};
const sendDataResponse = (response, statusCode, contentType, body) => {
    response.writeHead(statusCode, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
    });
    response.end(body);
};
const readRequestBody = (request) => new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    request.on('error', reject);
});
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const parseRequestBody = (raw) => {
    if (raw.length === 0) {
        return {};
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (!isRecord(parsed)) {
        return null;
    }
    return parsed;
};
const handleReadApi = async (options, requestPath, searchParams) => {
    const issueRepository = options.issueRepository ?? null;
    if (issueRepository === null) {
        return null;
    }
    const cache = options.issueTitleStateCache ?? null;
    const url = searchParams.get('url');
    switch (requestPath) {
        case '/api/itembody':
            return (0, consoleReadApi_1.handleItemBody)(issueRepository, url);
        case '/api/comments':
            return (0, consoleReadApi_1.handleComments)(issueRepository, url);
        case '/api/prfiles':
            return (0, consoleReadApi_1.handlePrFiles)(issueRepository, url);
        case '/api/prcommits':
            return (0, consoleReadApi_1.handlePrCommits)(issueRepository, url);
        case '/api/relatedprs':
            return (0, consoleReadApi_1.handleRelatedPrs)(issueRepository, url);
        case '/api/issuetitle':
            if (cache === null) {
                return null;
            }
            return (0, consoleReadApi_1.handleIssueTitle)(issueRepository, cache, url);
        default:
            return null;
    }
};
const handleOperationApi = async (options, requestPath, body) => {
    const issueRepository = options.issueRepository ?? null;
    const project = options.project ?? null;
    if (issueRepository === null || project === null) {
        return null;
    }
    const context = {
        issueRepository,
        project,
        consoleDataOutputDir: options.consoleDataOutputDir,
        pjcode: options.pjcode ?? null,
    };
    switch (requestPath) {
        case '/api/review':
            return (0, consoleOperationApi_1.handleReview)(context, body);
        case '/api/triage':
            return (0, consoleOperationApi_1.handleTriage)(context, body);
        case '/api/intmux':
            return (0, consoleOperationApi_1.handleIntmux)(context, body);
        default:
            return null;
    }
};
const handleTokenedRequest = async (options, request, response, requestPath, searchParams) => {
    const method = (request.method ?? 'GET').toUpperCase();
    if (requestPath.startsWith('/api/')) {
        if (method === 'GET') {
            const readResult = await handleReadApi(options, requestPath, searchParams);
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
            const operationResult = await handleOperationApi(options, requestPath, parsedBody);
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
        const dataRoute = (0, consoleDataDelivery_1.parseConsoleDataRoute)(requestPath);
        if (dataRoute !== null && options.consoleDataOutputDir !== null) {
            const dataResponse = (0, consoleDataDelivery_1.buildConsoleDataResponse)(options.consoleDataOutputDir, dataRoute);
            sendDataResponse(response, dataResponse.statusCode, dataResponse.contentType, dataResponse.body);
            return;
        }
    }
    sendNotFound(response);
};
const handleConsoleRequest = async (options, request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const requestPath = requestUrl.pathname;
    if ((0, exports.hasDotSegment)(requestPath)) {
        sendNotFound(response);
        return;
    }
    if ((0, exports.requiresToken)(requestPath)) {
        const providedToken = (0, exports.extractProvidedToken)(requestUrl.searchParams.get('k'), request.headers[exports.CONSOLE_TOKEN_HEADER]);
        if (!(0, exports.isTokenValid)(options.accessToken, providedToken)) {
            sendUnauthorized(response);
            return;
        }
        await handleTokenedRequest(options, request, response, requestPath, requestUrl.searchParams);
        return;
    }
    if (requestPath === '/' ||
        requestPath === '/index.html' ||
        (0, exports.isConsoleAppRoute)(requestPath)) {
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
exports.handleConsoleRequest = handleConsoleRequest;
const sendInternalServerError = (response) => {
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
const createConsoleServer = (options) => http.createServer((request, response) => {
    (0, exports.handleConsoleRequest)(options, request, response).catch((error) => {
        console.error('console request failed', error);
        sendInternalServerError(response);
    });
});
exports.createConsoleServer = createConsoleServer;
const startConsoleServer = (options) => new Promise((resolve, reject) => {
    const server = (0, exports.createConsoleServer)(options);
    server.once('error', reject);
    server.listen(options.port, () => {
        server.removeListener('error', reject);
        resolve(server);
    });
});
exports.startConsoleServer = startConsoleServer;
//# sourceMappingURL=consoleServer.js.map