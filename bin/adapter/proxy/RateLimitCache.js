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
exports.readRateLimit = exports.parseModelRateLimitsFromHeaders = exports.parseModelRateLimitsFromBody = exports.writeSubscriptionDisabled = exports.writeModelRateLimit = exports.writeRateLimit = exports.cachePathForToken = exports.hashToken = exports.cacheDir = exports.PERMISSION_DISABLED_COOLDOWN_SECONDS = exports.HEADERLESS_429_MAX_COOLDOWN_SECONDS = exports.HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS = exports.PROXY_PORT = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
exports.PROXY_PORT = 8787;
const HASH_ALGORITHM = 'sha256';
exports.HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS = 90;
exports.HEADERLESS_429_MAX_COOLDOWN_SECONDS = 600;
exports.PERMISSION_DISABLED_COOLDOWN_SECONDS = 3600;
const cacheDir = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'ratelimit');
};
exports.cacheDir = cacheDir;
const hashToken = (token) => crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');
exports.hashToken = hashToken;
const cachePathForToken = (token, baseDir = (0, exports.cacheDir)()) => path.join(baseDir, `${(0, exports.hashToken)(token)}.json`);
exports.cachePathForToken = cachePathForToken;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readPayload = (filePath) => {
    if (!fs.existsSync(filePath))
        return {};
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
};
const readModelWeeklyLimits = (payload) => {
    const stored = payload.modelWeeklyLimits;
    const result = {};
    if (!isRecord(stored))
        return result;
    for (const [limitType, value] of Object.entries(stored)) {
        if (!isRecord(value))
            continue;
        const rejected = value.rejected;
        const resetsAt = value.resetsAt;
        if (typeof rejected === 'boolean' && typeof resetsAt === 'number') {
            result[limitType] = { rejected, resetsAt };
        }
    }
    return result;
};
const cooldownEndFromRetryAfter = (retryAfterSeconds, nowEpochSeconds) => {
    const cooldownSeconds = retryAfterSeconds !== null && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds, exports.HEADERLESS_429_MAX_COOLDOWN_SECONDS)
        : exports.HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS;
    return nowEpochSeconds + cooldownSeconds;
};
const writeRateLimit = (token, headers, statusCode = null) => {
    const pick = (key) => {
        const value = headers[key];
        if (Array.isArray(value))
            return value[0];
        return value;
    };
    const rateLimitHeaders = {};
    for (const key of Object.keys(headers)) {
        if (key.startsWith('anthropic-ratelimit-')) {
            const value = pick(key);
            if (value !== undefined) {
                rateLimitHeaders[key] = value;
            }
        }
    }
    const dir = (0, exports.cacheDir)();
    const filePath = path.join(dir, `${(0, exports.hashToken)(token)}.json`);
    if (Object.keys(rateLimitHeaders).length === 0) {
        if (statusCode !== 429) {
            return;
        }
        const existing = readPayload(filePath);
        const retryAfterRaw = pick('retry-after');
        const retryAfterSeconds = retryAfterRaw !== undefined && Number.isFinite(Number(retryAfterRaw))
            ? Number(retryAfterRaw)
            : null;
        const blockedUntilEpoch = cooldownEndFromRetryAfter(retryAfterSeconds, Date.now() / 1000);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const payload = {
            ...existing,
            blockedUntilEpoch,
        };
        fs.writeFileSync(filePath, JSON.stringify(payload));
        return;
    }
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const existing = readPayload(filePath);
    const payload = {
        ts: Date.now() / 1000,
        headers: rateLimitHeaders,
        modelWeeklyLimits: readModelWeeklyLimits(existing),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload));
};
exports.writeRateLimit = writeRateLimit;
const writeModelRateLimit = (token, limits) => {
    const limitTypes = Object.keys(limits);
    if (limitTypes.length === 0)
        return;
    const dir = (0, exports.cacheDir)();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${(0, exports.hashToken)(token)}.json`);
    const existing = readPayload(filePath);
    const merged = {
        ...readModelWeeklyLimits(existing),
        ...limits,
    };
    const payload = {
        ...existing,
        modelWeeklyLimits: merged,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload));
};
exports.writeModelRateLimit = writeModelRateLimit;
const writeSubscriptionDisabled = (token, baseDir = (0, exports.cacheDir)()) => {
    const dir = baseDir;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${(0, exports.hashToken)(token)}.json`);
    const existing = readPayload(filePath);
    const payload = {
        ...existing,
        subscriptionDisabledEpoch: Date.now() / 1000,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload));
};
exports.writeSubscriptionDisabled = writeSubscriptionDisabled;
const parseModelRateLimitsFromBody = (body) => {
    const result = {};
    const matches = body.match(/\{[^{}]*"rateLimitType"[^{}]*\}|\{[^{}]*"resetsAt"[^{}]*"rateLimitType"[^{}]*\}/g);
    if (matches === null)
        return result;
    for (const candidate of matches) {
        let parsed;
        try {
            parsed = JSON.parse(candidate);
        }
        catch {
            continue;
        }
        if (!isRecord(parsed))
            continue;
        const rateLimitType = parsed.rateLimitType;
        const status = parsed.status;
        const resetsAt = parsed.resetsAt;
        if (typeof rateLimitType !== 'string')
            continue;
        if (typeof status !== 'string')
            continue;
        if (typeof resetsAt !== 'number')
            continue;
        result[rateLimitType] = {
            rejected: status === 'rejected',
            resetsAt,
        };
    }
    return result;
};
exports.parseModelRateLimitsFromBody = parseModelRateLimitsFromBody;
const HEADER_CLAIM_TO_LIMIT_TYPE = {
    '7d_sonnet': 'seven_day_sonnet',
    '7d_opus': 'seven_day_opus',
};
const parseModelRateLimitsFromHeaders = (headers) => {
    const result = {};
    for (const [headerClaim, limitType] of Object.entries(HEADER_CLAIM_TO_LIMIT_TYPE)) {
        const status = headers[`anthropic-ratelimit-unified-${headerClaim}-status`];
        const resetRaw = headers[`anthropic-ratelimit-unified-${headerClaim}-reset`];
        if (status === undefined)
            continue;
        const resetsAt = resetRaw !== undefined && Number.isFinite(Number(resetRaw))
            ? Number(resetRaw)
            : 0;
        result[limitType] = {
            rejected: status === 'rejected',
            resetsAt,
        };
    }
    return result;
};
exports.parseModelRateLimitsFromHeaders = parseModelRateLimitsFromHeaders;
const readRateLimit = (token, baseDir = (0, exports.cacheDir)()) => {
    const filePath = (0, exports.cachePathForToken)(token, baseDir);
    if (!fs.existsSync(filePath))
        return null;
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed))
            return null;
        const headersUnknown = parsed.headers;
        const headers = {};
        if (isRecord(headersUnknown)) {
            for (const [key, value] of Object.entries(headersUnknown)) {
                if (typeof value === 'string') {
                    headers[key] = value;
                }
            }
        }
        const num = (key) => {
            const value = headers[key];
            if (typeof value !== 'string')
                return 0;
            const parsedValue = Number(value);
            return Number.isFinite(parsedValue) ? parsedValue : 0;
        };
        const status = headers['anthropic-ratelimit-unified-status'];
        const fiveHourStatus = headers['anthropic-ratelimit-unified-5h-status'];
        const sevenDayStatus = headers['anthropic-ratelimit-unified-7d-status'];
        const overageDisabledReason = headers['anthropic-ratelimit-unified-overage-disabled-reason'];
        const unifiedRejected = status === 'rejected';
        const fiveHourRejected = fiveHourStatus === 'rejected';
        const sevenDayRejected = sevenDayStatus === 'rejected';
        const storedTs = parsed.ts;
        const lastUpdatedEpoch = typeof storedTs === 'number' ? storedTs : 0;
        const storedBlockedUntil = parsed.blockedUntilEpoch;
        const blockedUntilEpoch = typeof storedBlockedUntil === 'number' ? storedBlockedUntil : 0;
        const storedSubscriptionDisabledEpoch = parsed.subscriptionDisabledEpoch;
        const subscriptionDisabledEpoch = typeof storedSubscriptionDisabledEpoch === 'number'
            ? storedSubscriptionDisabledEpoch
            : 0;
        const nowEpochSeconds = Date.now() / 1000;
        const subscriptionDisabled = subscriptionDisabledEpoch > 0 &&
            nowEpochSeconds - subscriptionDisabledEpoch <
                exports.PERMISSION_DISABLED_COOLDOWN_SECONDS;
        return {
            fiveHourUtilization: num('anthropic-ratelimit-unified-5h-utilization'),
            fiveHourReset: num('anthropic-ratelimit-unified-5h-reset'),
            sevenDayUtilization: num('anthropic-ratelimit-unified-7d-utilization'),
            sevenDayReset: num('anthropic-ratelimit-unified-7d-reset'),
            blocked: status === 'blocked' ||
                fiveHourStatus === 'blocked' ||
                sevenDayStatus === 'blocked',
            rejected: unifiedRejected || fiveHourRejected || sevenDayRejected,
            unifiedRejected,
            fiveHourRejected,
            sevenDayRejected,
            unifiedStatus: status ?? null,
            overageDisabledReason: overageDisabledReason ?? null,
            modelWeeklyLimits: {
                ...(0, exports.parseModelRateLimitsFromHeaders)(headers),
                ...readModelWeeklyLimits(parsed),
            },
            lastUpdatedEpoch,
            blockedUntilEpoch,
            subscriptionDisabled,
        };
    }
    catch {
        return null;
    }
};
exports.readRateLimit = readRateLimit;
//# sourceMappingURL=RateLimitCache.js.map