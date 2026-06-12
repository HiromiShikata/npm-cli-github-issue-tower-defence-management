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
exports.startPrReviewViewer = void 0;
const http = __importStar(require("http"));
const ensurePrReviewViewerRunning_1 = require("./ensurePrReviewViewerRunning");
const startPrReviewViewer = (accessKey, port) => {
    const server = http.createServer((request, response) => {
        const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
        const keyParam = url.searchParams.get('key');
        const authHeader = request.headers['authorization'];
        const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null;
        if (keyParam !== accessKey && bearerToken !== accessKey) {
            response.writeHead(403, { 'content-type': 'text/plain' });
            response.end('Forbidden');
            return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`pr-review-viewer listening on 127.0.0.1:${port}`);
    });
    return server;
};
exports.startPrReviewViewer = startPrReviewViewer;
if (require.main === module) {
    const accessKey = process.env.PR_REVIEW_VIEWER_ACCESS_KEY ?? '';
    const port = process.env.PR_REVIEW_VIEWER_PORT
        ? Number(process.env.PR_REVIEW_VIEWER_PORT)
        : ensurePrReviewViewerRunning_1.PR_REVIEW_VIEWER_DEFAULT_PORT;
    if (!accessKey) {
        console.error('PR_REVIEW_VIEWER_ACCESS_KEY environment variable is required');
        process.exit(1);
    }
    startPrReviewViewer(accessKey, port);
}
//# sourceMappingURL=prReviewViewerEntry.js.map