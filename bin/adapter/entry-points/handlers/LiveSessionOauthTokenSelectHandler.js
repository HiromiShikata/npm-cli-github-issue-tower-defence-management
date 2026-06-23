"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSessionOauthTokenSelectHandler = void 0;
const LiveSessionOauthTokenSelectUseCase_1 = require("../../../domain/usecases/LiveSessionOauthTokenSelectUseCase");
const ProcClaudeLiveSessionRepository_1 = require("../../repositories/ProcClaudeLiveSessionRepository");
const RateLimitCache_1 = require("../../proxy/RateLimitCache");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const OauthTokenSelectHandler_1 = require("./OauthTokenSelectHandler");
class LiveSessionOauthTokenSelectHandler {
    constructor(useCase = new LiveSessionOauthTokenSelectUseCase_1.LiveSessionOauthTokenSelectUseCase(), liveSessionRepository = new ProcClaudeLiveSessionRepository_1.ProcClaudeLiveSessionRepository()) {
        this.useCase = useCase;
        this.liveSessionRepository = liveSessionRepository;
        this.handle = (input) => {
            const tokenListJsonPath = (0, OauthTokenSelectHandler_1.resolveTokenListJsonPath)(input.tokenListJsonPath);
            if (tokenListJsonPath === null) {
                return {
                    selectedToken: null,
                    selectedName: null,
                    diagnostics: [
                        'No token list path provided. Pass --tokenListJsonPath or set CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH.',
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
            const cacheDirectory = (0, OauthTokenSelectHandler_1.resolveCacheDirectory)(input.cacheDirectory);
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
                };
            });
            const liveSessions = this.liveSessionRepository.listLiveSessions();
            const result = this.useCase.run(candidates, liveSessions, input.nowEpochSeconds);
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
                return `${metric.name}: ${metric.liveSessionCount} live session(s), 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s -> ${status}`;
            });
            if (result.selected === null) {
                lines.push('No eligible token passed the rate-limit filter.');
            }
            else {
                lines.push(`Selected ${result.selected.name} (fewest live sessions, then soonest 7d reset among eligible tokens).`);
            }
            return lines;
        };
    }
}
exports.LiveSessionOauthTokenSelectHandler = LiveSessionOauthTokenSelectHandler;
//# sourceMappingURL=LiveSessionOauthTokenSelectHandler.js.map