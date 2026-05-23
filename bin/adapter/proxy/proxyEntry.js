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
const UPSTREAM_HOST = 'api.anthropic.com';
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
const startProxy = (port) => {
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
                    (0, RateLimitCache_1.writeRateLimit)(token, upstreamResponse.headers);
                }
                catch (error) {
                    console.error('Failed to write rate limit cache:', error);
                }
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
};
exports.startProxy = startProxy;
if (require.main === module) {
    startProxy(RateLimitCache_1.PROXY_PORT);
}
//# sourceMappingURL=proxyEntry.js.map