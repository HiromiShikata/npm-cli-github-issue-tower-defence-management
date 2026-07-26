"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitSnapshotRepository = void 0;
const TokenListLoader_1 = require("../proxy/TokenListLoader");
const RateLimitCache_1 = require("../proxy/RateLimitCache");
class RateLimitSnapshotRepository {
    constructor(tokenListJsonPath, baseDir = (0, RateLimitCache_1.cacheDir)()) {
        this.tokenListJsonPath = tokenListJsonPath;
        this.baseDir = baseDir;
        this.listSnapshots = () => {
            const entries = (0, TokenListLoader_1.loadTokenEntries)(this.tokenListJsonPath);
            if (entries === null) {
                return [];
            }
            const snapshots = [];
            for (const { name, token } of entries) {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token, this.baseDir);
                if (snapshot === null) {
                    continue;
                }
                snapshots.push({
                    token,
                    name,
                    fiveHourUtilization: snapshot.fiveHourUtilization,
                    fiveHourReset: snapshot.fiveHourReset,
                    sevenDayUtilization: snapshot.sevenDayUtilization,
                    sevenDayReset: snapshot.sevenDayReset,
                    blocked: snapshot.blocked,
                    rejected: snapshot.rejected,
                    blockedUntilEpoch: snapshot.blockedUntilEpoch,
                    modelWeeklyLimits: this.toModelWeeklyLimits(snapshot.modelWeeklyLimits),
                    lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
                });
            }
            return snapshots;
        };
        this.toModelWeeklyLimits = (modelWeeklyLimits) => Object.values(modelWeeklyLimits).map((limit) => ({
            rejected: limit.rejected,
            resetsAt: limit.resetsAt,
        }));
    }
}
exports.RateLimitSnapshotRepository = RateLimitSnapshotRepository;
//# sourceMappingURL=RateLimitSnapshotRepository.js.map