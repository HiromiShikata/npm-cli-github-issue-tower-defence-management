"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitSnapshotRepository = void 0;
const RateLimitCache_1 = require("../proxy/RateLimitCache");
class RateLimitSnapshotRepository {
    constructor(baseDir = (0, RateLimitCache_1.cacheDir)()) {
        this.baseDir = baseDir;
        this.getSnapshot = (token) => {
            const snapshot = (0, RateLimitCache_1.readRateLimit)(token, this.baseDir);
            if (snapshot === null) {
                return null;
            }
            return {
                fiveHourUtilization: snapshot.fiveHourUtilization,
                sevenDayUtilization: snapshot.sevenDayUtilization,
                blocked: snapshot.blocked,
                rejected: snapshot.rejected,
                blockedUntilEpoch: snapshot.blockedUntilEpoch,
                lastUpdatedEpoch: snapshot.lastUpdatedEpoch,
            };
        };
    }
}
exports.RateLimitSnapshotRepository = RateLimitSnapshotRepository;
//# sourceMappingURL=RateLimitSnapshotRepository.js.map