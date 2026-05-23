"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyClaudeTokenUsageRepository = void 0;
const ensureProxyRunning_1 = require("../proxy/ensureProxyRunning");
const RateLimitCache_1 = require("../proxy/RateLimitCache");
const TokenListLoader_1 = require("../proxy/TokenListLoader");
class ProxyClaudeTokenUsageRepository {
    constructor(tokenListJsonPath, port = RateLimitCache_1.PROXY_PORT) {
        this.tokenListJsonPath = tokenListJsonPath;
        this.port = port;
        this.ensureObservable = async () => {
            await (0, ensureProxyRunning_1.ensureProxyRunning)(this.port);
        };
        this.getAvailableTokenUsages = async () => {
            if (this.tokenListJsonPath === null) {
                return [];
            }
            const tokens = (0, TokenListLoader_1.loadTokens)(this.tokenListJsonPath);
            if (tokens === null) {
                return [];
            }
            return tokens.map((token) => {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token);
                return {
                    token,
                    fiveHourUtilization: snapshot ? snapshot.fiveHourUtilization : 0,
                    blocked: snapshot?.blocked ?? false,
                    rejected: snapshot?.rejected ?? false,
                };
            });
        };
        this.proxyBaseUrl = () => `http://127.0.0.1:${this.port}`;
    }
}
exports.ProxyClaudeTokenUsageRepository = ProxyClaudeTokenUsageRepository;
//# sourceMappingURL=ProxyClaudeTokenUsageRepository.js.map