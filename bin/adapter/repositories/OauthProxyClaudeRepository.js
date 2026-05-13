"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthProxyClaudeRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const OVERAGE_DISABLED_REASONS_INDICATING_AVAILABLE_PLAN_QUOTA = new Set(['org_level_disabled_until']);
const isProxyFile = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    return true;
};
class OauthProxyClaudeRepository {
    constructor(filePath = process.env['CLAUDE_RATELIMIT_FILE'] ??
        '/tmp/claude-ratelimit.json') {
        this.filePath = filePath;
    }
    async getUsage() {
        if (!fs_1.default.existsSync(this.filePath)) {
            return [];
        }
        let parsed;
        try {
            const content = fs_1.default.readFileSync(this.filePath, 'utf-8');
            parsed = JSON.parse(content);
        }
        catch {
            return [];
        }
        if (!isProxyFile(parsed)) {
            return [];
        }
        const headers = parsed.headers;
        if (!headers) {
            return [];
        }
        const usages = [];
        const fiveHourUtilization = headers['anthropic-ratelimit-unified-5h-utilization'];
        const fiveHourReset = headers['anthropic-ratelimit-unified-5h-reset'];
        if (fiveHourUtilization !== undefined) {
            const utilizationPercentage = parseFloat(fiveHourUtilization) * 100;
            if (!isNaN(utilizationPercentage)) {
                usages.push({
                    hour: 5,
                    utilizationPercentage,
                    resetsAt: fiveHourReset
                        ? new Date(parseInt(fiveHourReset, 10) * 1000)
                        : new Date(),
                });
            }
        }
        const sevenDayUtilization = headers['anthropic-ratelimit-unified-7d-utilization'];
        const sevenDayReset = headers['anthropic-ratelimit-unified-7d-reset'];
        if (sevenDayUtilization !== undefined) {
            const utilizationPercentage = parseFloat(sevenDayUtilization) * 100;
            if (!isNaN(utilizationPercentage)) {
                usages.push({
                    hour: 168,
                    utilizationPercentage,
                    resetsAt: sevenDayReset
                        ? new Date(parseInt(sevenDayReset, 10) * 1000)
                        : new Date(),
                });
            }
        }
        const overageStatus = headers['anthropic-ratelimit-unified-overage-status'];
        const overageDisabledReason = headers['anthropic-ratelimit-unified-overage-disabled-reason'];
        const overageDisabledReasonIndicatesAvailablePlanQuota = overageDisabledReason !== undefined &&
            OVERAGE_DISABLED_REASONS_INDICATING_AVAILABLE_PLAN_QUOTA.has(overageDisabledReason);
        if (overageStatus === 'rejected' &&
            !overageDisabledReasonIndicatesAvailablePlanQuota &&
            !usages.some((u) => u.utilizationPercentage >= 100)) {
            usages.push({
                hour: 168,
                utilizationPercentage: 100,
                resetsAt: sevenDayReset
                    ? new Date(parseInt(sevenDayReset, 10) * 1000)
                    : new Date(),
            });
        }
        return usages;
    }
    async isClaudeAvailable(threshold) {
        const usages = await this.getUsage();
        if (usages.length === 0) {
            return false;
        }
        return usages.every((usage) => usage.utilizationPercentage < threshold);
    }
}
exports.OauthProxyClaudeRepository = OauthProxyClaudeRepository;
//# sourceMappingURL=OauthProxyClaudeRepository.js.map