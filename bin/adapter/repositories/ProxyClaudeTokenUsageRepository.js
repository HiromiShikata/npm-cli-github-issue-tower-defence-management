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
exports.ProxyClaudeTokenUsageRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
            const entries = (0, TokenListLoader_1.loadTokenEntries)(this.tokenListJsonPath);
            if (entries === null) {
                return [];
            }
            const nowEpochSeconds = Date.now() / 1000;
            return entries.map(({ name, token }) => {
                const snapshot = (0, RateLimitCache_1.readRateLimit)(token);
                if (snapshot === null) {
                    return {
                        name,
                        token,
                        fiveHourUtilization: 0,
                        sevenDayUtilization: 0,
                        blocked: false,
                        rejected: false,
                        fiveHourRejected: false,
                        modelWeeklyLimits: {},
                        blockedUntilEpoch: 0,
                    };
                }
                const fiveHourExpired = nowEpochSeconds > snapshot.fiveHourReset;
                const sevenDayExpired = nowEpochSeconds > snapshot.sevenDayReset;
                const fiveHourUtilization = fiveHourExpired
                    ? 0
                    : snapshot.fiveHourUtilization;
                const sevenDayUtilization = sevenDayExpired
                    ? 0
                    : snapshot.sevenDayUtilization;
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
                const hasAnySevenDayWeeklyLimit = modelWeeklyLimits['seven_day'] !== undefined ||
                    modelWeeklyLimits['seven_day_opus'] !== undefined ||
                    modelWeeklyLimits['seven_day_sonnet'] !== undefined;
                const needsGenericSevenDayBridge = modelWeeklyLimits['seven_day'] === undefined &&
                    (!hasAnySevenDayWeeklyLimit || sevenDayRejectionActive);
                if (snapshot.sevenDayReset > 0 &&
                    !sevenDayExpired &&
                    needsGenericSevenDayBridge) {
                    modelWeeklyLimits['seven_day'] = {
                        rejected: sevenDayRejectionActive,
                        resetsAt: snapshot.sevenDayReset,
                    };
                }
                const cooldownActive = snapshot.blockedUntilEpoch > nowEpochSeconds;
                return {
                    name,
                    token,
                    fiveHourUtilization,
                    sevenDayUtilization,
                    blocked: snapshot.blocked,
                    rejected,
                    fiveHourRejected: fiveHourRejectionActive,
                    modelWeeklyLimits,
                    blockedUntilEpoch: cooldownActive ? snapshot.blockedUntilEpoch : 0,
                };
            });
        };
        this.getTokenInFlightCounts = async () => {
            const counts = {};
            let procEntries;
            try {
                procEntries = fs.readdirSync('/proc');
            }
            catch {
                return counts;
            }
            const tokenByPid = new Map();
            for (const entry of procEntries) {
                if (!/^\d+$/.test(entry))
                    continue;
                const environPath = path.join('/proc', entry, 'environ');
                let environ;
                try {
                    environ = fs.readFileSync(environPath, 'utf8');
                }
                catch {
                    continue;
                }
                const vars = environ.split('\0');
                const tokenEntry = vars.find((v) => v.startsWith('CLAUDE_CODE_OAUTH_TOKEN='));
                if (tokenEntry === undefined)
                    continue;
                const token = tokenEntry.slice('CLAUDE_CODE_OAUTH_TOKEN='.length);
                if (token.length === 0)
                    continue;
                tokenByPid.set(Number(entry), token);
            }
            for (const [pid, token] of tokenByPid) {
                const parentPid = this.readParentPid(pid);
                if (parentPid !== null && tokenByPid.has(parentPid))
                    continue;
                counts[token] = (counts[token] ?? 0) + 1;
            }
            return counts;
        };
        this.readParentPid = (pid) => {
            let stat;
            try {
                stat = fs.readFileSync(path.join('/proc', String(pid), 'stat'), 'utf8');
            }
            catch {
                return null;
            }
            const afterComm = stat.slice(stat.lastIndexOf(') ') + 2);
            const fields = afterComm.trim().split(/\s+/);
            const parentPid = Number(fields[1]);
            if (!Number.isInteger(parentPid))
                return null;
            return parentPid;
        };
        this.proxyBaseUrl = () => `http://127.0.0.1:${this.port}`;
    }
}
exports.ProxyClaudeTokenUsageRepository = ProxyClaudeTokenUsageRepository;
//# sourceMappingURL=ProxyClaudeTokenUsageRepository.js.map