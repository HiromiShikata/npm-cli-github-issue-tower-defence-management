"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthTokenSelectHandler = exports.resolveCacheDirectory = exports.resolveTokenListJsonPath = void 0;
const OauthTokenSelectUseCase_1 = require("../../../domain/usecases/OauthTokenSelectUseCase");
const RateLimitCache_1 = require("../../proxy/RateLimitCache");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const DEFAULT_TOKEN_LIST_PATH_ENV = 'CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH';
const DEFAULT_CACHE_DIRECTORY_ENV = 'TDPM_RATELIMIT_CACHE_DIR';
const resolveTokenListJsonPath = (explicitPath) => {
    if (explicitPath !== null && explicitPath.length > 0) {
        return explicitPath;
    }
    const fromEnv = process.env[DEFAULT_TOKEN_LIST_PATH_ENV];
    if (fromEnv !== undefined && fromEnv.length > 0) {
        return fromEnv;
    }
    return null;
};
exports.resolveTokenListJsonPath = resolveTokenListJsonPath;
const resolveCacheDirectory = (explicitDirectory) => {
    if (explicitDirectory !== null && explicitDirectory.length > 0) {
        return explicitDirectory;
    }
    const fromEnv = process.env[DEFAULT_CACHE_DIRECTORY_ENV];
    if (fromEnv !== undefined && fromEnv.length > 0) {
        return fromEnv;
    }
    return (0, RateLimitCache_1.cacheDir)();
};
exports.resolveCacheDirectory = resolveCacheDirectory;
class OauthTokenSelectHandler {
    constructor(useCase = new OauthTokenSelectUseCase_1.OauthTokenSelectUseCase()) {
        this.useCase = useCase;
        this.handle = (input) => {
            const tokenListJsonPath = (0, exports.resolveTokenListJsonPath)(input.tokenListJsonPath);
            if (tokenListJsonPath === null) {
                return {
                    selectedToken: null,
                    selectedName: null,
                    diagnostics: [
                        `No token list path provided. Pass --tokenListJsonPath or set ${DEFAULT_TOKEN_LIST_PATH_ENV}.`,
                    ],
                };
            }
            const entries = (0, TokenListLoader_1.loadTokenEntries)(tokenListJsonPath);
            if (entries === null) {
                return {
                    selectedToken: null,
                    selectedName: null,
                    diagnostics: [
                        `No usable token entries loaded from ${tokenListJsonPath}.`,
                    ],
                };
            }
            const cacheDirectory = (0, exports.resolveCacheDirectory)(input.cacheDirectory);
            const candidates = entries.map(({ name, token }) => {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token, cacheDirectory);
                return {
                    name,
                    token,
                    snapshot: snapshot === null
                        ? null
                        : {
                            fiveHourUtilization: snapshot.fiveHourUtilization,
                            fiveHourReset: snapshot.fiveHourReset,
                            sevenDayUtilization: snapshot.sevenDayUtilization,
                            sevenDayReset: snapshot.sevenDayReset,
                        },
                    subscriptionDisabled: snapshot?.subscriptionDisabled ?? false,
                    unifiedRejected: snapshot?.unifiedRejected ?? false,
                };
            });
            const result = this.useCase.run(candidates, input.nowEpochSeconds);
            return {
                selectedToken: result.selected?.token ?? null,
                selectedName: result.selected?.name ?? null,
                diagnostics: this.formatDiagnostics(result, input.nowEpochSeconds),
            };
        };
        this.formatDiagnostics = (result, nowEpochSeconds) => {
            const lines = result.metrics.map((metric) => {
                const secondsUntilSevenDayEnd = Math.round(metric.sevenDayEndEpoch - nowEpochSeconds);
                const status = metric.eligible
                    ? 'eligible'
                    : `excluded (${metric.exclusionReason})`;
                return `${metric.name}: 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s -> ${status}`;
            });
            if (result.selected === null) {
                lines.push('No eligible token passed the rate-limit filter.');
            }
            else {
                lines.push(`Selected ${result.selected.name} (soonest 7d reset among eligible tokens).`);
            }
            return lines;
        };
    }
}
exports.OauthTokenSelectHandler = OauthTokenSelectHandler;
//# sourceMappingURL=OauthTokenSelectHandler.js.map