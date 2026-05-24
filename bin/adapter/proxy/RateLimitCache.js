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
exports.readRateLimit = exports.parseModelRateLimitsFromBody = exports.writeModelRateLimit = exports.writeRateLimit = exports.cachePathForToken = exports.hashToken = exports.cacheDir = exports.PROXY_PORT = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
exports.PROXY_PORT = 8787;
const HASH_ALGORITHM = 'sha256';
const cacheDir = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'ratelimit');
};
exports.cacheDir = cacheDir;
const hashToken = (token) => crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');
exports.hashToken = hashToken;
const cachePathForToken = (token) => path.join((0, exports.cacheDir)(), `${(0, exports.hashToken)(token)}.json`);
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
const writeRateLimit = (token, headers) => {
    const dir = (0, exports.cacheDir)();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const pick = (key) => {
        const value = headers[key];
        if (Array.isArray(value))
            return value[0];
        return value;
    };
    const filePath = path.join(dir, `${(0, exports.hashToken)(token)}.json`);
    const existing = readPayload(filePath);
    const payload = {
        ts: Date.now() / 1000,
        headers: {
            'anthropic-ratelimit-unified-status': pick('anthropic-ratelimit-unified-status'),
            'anthropic-ratelimit-unified-5h-status': pick('anthropic-ratelimit-unified-5h-status'),
            'anthropic-ratelimit-unified-5h-reset': pick('anthropic-ratelimit-unified-5h-reset'),
            'anthropic-ratelimit-unified-5h-utilization': pick('anthropic-ratelimit-unified-5h-utilization'),
            'anthropic-ratelimit-unified-7d-status': pick('anthropic-ratelimit-unified-7d-status'),
            'anthropic-ratelimit-unified-7d-reset': pick('anthropic-ratelimit-unified-7d-reset'),
            'anthropic-ratelimit-unified-7d-utilization': pick('anthropic-ratelimit-unified-7d-utilization'),
        },
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
const readRateLimit = (token) => {
    const filePath = (0, exports.cachePathForToken)(token);
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
        const unifiedRejected = status === 'rejected';
        const fiveHourRejected = fiveHourStatus === 'rejected';
        const sevenDayRejected = sevenDayStatus === 'rejected';
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
            modelWeeklyLimits: readModelWeeklyLimits(parsed),
        };
    }
    catch {
        return null;
    }
};
exports.readRateLimit = readRateLimit;
//# sourceMappingURL=RateLimitCache.js.map