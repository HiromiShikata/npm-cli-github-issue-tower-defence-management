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
            const nowEpochSeconds = Date.now() / 1000;
            return tokens.map((token) => {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token);
                if (snapshot === null) {
                    return {
                        token,
                        fiveHourUtilization: 0,
                        blocked: false,
                        rejected: false,
                        modelWeeklyLimits: {},
                    };
                }
                const fiveHourExpired = nowEpochSeconds > snapshot.fiveHourReset;
                const sevenDayExpired = nowEpochSeconds > snapshot.sevenDayReset;
                const fiveHourUtilization = fiveHourExpired
                    ? 0
                    : snapshot.fiveHourUtilization;
                const fiveHourRejectionActive = snapshot.fiveHourRejected && !fiveHourExpired;
                const sevenDayRejectionActive = snapshot.sevenDayRejected && !sevenDayExpired;
                const unifiedRejectionActive = snapshot.unifiedRejected && !fiveHourExpired;
                const rejected = unifiedRejectionActive ||
                    fiveHourRejectionActive ||
                    sevenDayRejectionActive;
                const modelWeeklyLimits = {};
                for (const [limitType, limit] of Object.entries(snapshot.modelWeeklyLimits)) {
                    const expired = nowEpochSeconds > limit.resetsAt;
                    modelWeeklyLimits[limitType] = {
                        rejected: limit.rejected && !expired,
                        resetsAt: limit.resetsAt,
                    };
                }
                return {
                    token,
                    fiveHourUtilization,
                    blocked: snapshot.blocked,
                    rejected,
                    modelWeeklyLimits,
                };
            });
        };
        this.proxyBaseUrl = () => `http://127.0.0.1:${this.port}`;
    }
}
exports.ProxyClaudeTokenUsageRepository = ProxyClaudeTokenUsageRepository;
//# sourceMappingURL=ProxyClaudeTokenUsageRepository.js.map