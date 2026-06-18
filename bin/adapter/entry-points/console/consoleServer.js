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
exports.startConsoleServer = exports.createConsoleServer = exports.handleConsoleRequest = exports.extractProvidedToken = exports.isTokenValid = exports.requiresToken = exports.hasDotSegment = exports.CONSOLE_TOKEN_HEADER = exports.DEFAULT_CONSOLE_PORT = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
const handleConsoleRequest = (options, request, response) => {
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
        sendNotFound(response);
        return;
    }
    if (requestPath === '/' || requestPath === '/index.html') {
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
const createConsoleServer = (options) => http.createServer((request, response) => {
    (0, exports.handleConsoleRequest)(options, request, response);
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