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
exports.extractToken = exports.startProxy = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const RateLimitCache_1 = require("./RateLimitCache");
const ClaudeMessageResponseParser_1 = require("./ClaudeMessageResponseParser");
const SqliteClaudeMessageResponseRepository_1 = require("../repositories/SqliteClaudeMessageResponseRepository");
const UPSTREAM_HOST = 'api.anthropic.com';
const MAX_INSPECTED_BODY_BYTES = 1024 * 1024;
const BEARER_PREFIX = 'bearer ';
const extractToken = (authorization) => {
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    if (typeof value !== 'string')
        return null;
    if (value.length < BEARER_PREFIX.length)
        return null;
    if (value.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX)
        return null;
    const token = value.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
};
exports.extractToken = extractToken;
const startProxy = (port, claudeMessageResponseRepository = null) => {
    const server = http.createServer((clientRequest, clientResponse) => {
        const token = extractToken(clientRequest.headers['authorization']);
        const upstreamHeaders = {
            ...clientRequest.headers,
            host: UPSTREAM_HOST,
        };
        const upstreamRequest = https.request({
            host: UPSTREAM_HOST,
            port: 443,
            method: clientRequest.method,
            path: clientRequest.url,
            headers: upstreamHeaders,
        }, (upstreamResponse) => {
            if (token !== null) {
                try {
                    (0, RateLimitCache_1.writeRateLimit)(token, upstreamResponse.headers, upstreamResponse.statusCode ?? null);
                }
                catch (error) {
                    console.error('Failed to write rate limit cache:', error);
                }
                const inspectedChunks = [];
                let inspectedBytes = 0;
                upstreamResponse.on('data', (chunk) => {
                    if (inspectedBytes >= MAX_INSPECTED_BODY_BYTES)
                        return;
                    inspectedChunks.push(new Uint8Array(chunk));
                    inspectedBytes += chunk.length;
                });
                upstreamResponse.on('end', () => {
                    const body = Buffer.concat(inspectedChunks).toString('utf8');
                    try {
                        const limits = (0, RateLimitCache_1.parseModelRateLimitsFromBody)(body);
                        (0, RateLimitCache_1.writeModelRateLimit)(token, limits);
                    }
                    catch (error) {
                        console.error('Failed to write model rate limit cache:', error);
                    }
                    if (claudeMessageResponseRepository !== null) {
                        try {
                            const response = (0, ClaudeMessageResponseParser_1.parseClaudeMessageResponse)((0, RateLimitCache_1.hashToken)(token), upstreamResponse.statusCode ?? 0, upstreamResponse.headers, body);
                            claudeMessageResponseRepository.append(response);
                        }
                        catch (error) {
                            console.error('Failed to record Claude message response:', error);
                        }
                    }
                });
            }
            clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(clientResponse);
        });
        upstreamRequest.on('error', (error) => {
            console.error('Upstream request error:', error.message);
            if (!clientResponse.headersSent) {
                clientResponse.writeHead(502, { 'content-type': 'text/plain' });
            }
            clientResponse.end('Upstream error');
        });
        clientRequest.pipe(upstreamRequest);
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`tdpm proxy listening on 127.0.0.1:${port}`);
    });
    return server;
};
exports.startProxy = startProxy;
if (require.main === module) {
    const dbPath = './db/claude_message_response.db';
    const repository = new SqliteClaudeMessageResponseRepository_1.SqliteClaudeMessageResponseRepository(dbPath);
    startProxy(RateLimitCache_1.PROXY_PORT, repository);
}
//# sourceMappingURL=proxyEntry.js.map