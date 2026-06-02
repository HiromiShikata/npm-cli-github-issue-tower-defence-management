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
exports.ProxyRateLimitCacheRepository = void 0;
const http = __importStar(require("http"));
const RateLimitCache_1 = require("../proxy/RateLimitCache");
const TokenListLoader_1 = require("../proxy/TokenListLoader");
const HAIKU_MODEL = 'claude-haiku-4-5';
const PROBE_REQUEST_BODY = JSON.stringify({
    model: HAIKU_MODEL,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'hi' }],
});
class ProxyRateLimitCacheRepository {
    constructor(tokenListJsonPath, port = RateLimitCache_1.PROXY_PORT) {
        this.tokenListJsonPath = tokenListJsonPath;
        this.port = port;
        this.getTokenRateLimitCaches = () => {
            if (this.tokenListJsonPath === null) {
                return [];
            }
            const tokens = (0, TokenListLoader_1.loadTokens)(this.tokenListJsonPath);
            if (tokens === null) {
                return [];
            }
            return tokens.map((token) => {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token);
                const unifiedReset = snapshot !== null ? snapshot.fiveHourReset : 0;
                const lastProbeEpoch = snapshot !== null ? snapshot.lastUpdatedEpoch : 0;
                return { token, unifiedReset, lastProbeEpoch };
            });
        };
        this.probeToken = async (token) => {
            await new Promise((resolve) => {
                const request = http.request({
                    host: '127.0.0.1',
                    port: this.port,
                    method: 'POST',
                    path: '/v1/messages',
                    headers: {
                        'content-type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        authorization: `Bearer ${token}`,
                        'content-length': Buffer.byteLength(PROBE_REQUEST_BODY),
                    },
                }, (response) => {
                    response.resume();
                    response.on('end', () => resolve());
                });
                request.on('error', (error) => {
                    console.error(`[UpdateRateLimitCache] Probe request failed for token hash: ${error.message}`);
                    resolve();
                });
                request.write(PROBE_REQUEST_BODY);
                request.end();
            });
        };
    }
}
exports.ProxyRateLimitCacheRepository = ProxyRateLimitCacheRepository;
//# sourceMappingURL=ProxyRateLimitCacheRepository.js.map