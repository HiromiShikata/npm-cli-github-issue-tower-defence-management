"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithGitHubRateLimitRetry = exports.computeBoundedBackoffMs = exports.computeRateLimitResetIso = exports.hasRateLimitSignals = exports.realSleep = exports.RATE_LIMIT_BASE_BACKOFF_MS = exports.RATE_LIMIT_TOTAL_BACKOFF_CAP_MS = exports.RATE_LIMIT_MAX_RETRIES = void 0;
exports.RATE_LIMIT_MAX_RETRIES = 3;
exports.RATE_LIMIT_TOTAL_BACKOFF_CAP_MS = 5000;
exports.RATE_LIMIT_BASE_BACKOFF_MS = 250;
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit|secondary rate limit|abuse/i;
const realSleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
exports.realSleep = realSleep;
const parseNonNegativeIntegerHeader = (value) => {
    if (value === null) {
        return null;
    }
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
};
const hasRateLimitSignals = (status, headers, bodyText) => {
    if (status !== 403 && status !== 429) {
        return false;
    }
    if (parseNonNegativeIntegerHeader(headers.get('x-ratelimit-remaining')) === 0) {
        return true;
    }
    if (headers.get('retry-after') !== null) {
        return true;
    }
    return RATE_LIMIT_MESSAGE_PATTERN.test(bodyText);
};
exports.hasRateLimitSignals = hasRateLimitSignals;
const computeRateLimitResetIso = (headers) => {
    const resetEpochSeconds = parseNonNegativeIntegerHeader(headers.get('x-ratelimit-reset'));
    if (resetEpochSeconds === null) {
        return null;
    }
    return new Date(resetEpochSeconds * 1000).toISOString();
};
exports.computeRateLimitResetIso = computeRateLimitResetIso;
const computeBoundedBackoffMs = (headers, attempt, elapsedMs) => {
    const remainingBudgetMs = exports.RATE_LIMIT_TOTAL_BACKOFF_CAP_MS - elapsedMs;
    if (remainingBudgetMs <= 0) {
        return 0;
    }
    const exponentialMs = exports.RATE_LIMIT_BASE_BACKOFF_MS * Math.pow(2, attempt);
    const retryAfterSeconds = parseNonNegativeIntegerHeader(headers.get('retry-after'));
    const requestedMs = retryAfterSeconds !== null ? retryAfterSeconds * 1000 : exponentialMs;
    return Math.min(requestedMs, remainingBudgetMs);
};
exports.computeBoundedBackoffMs = computeBoundedBackoffMs;
const fetchWithGitHubRateLimitRetry = async (request, sleep = exports.realSleep, now = Date.now) => {
    const startMs = now();
    let attempt = 0;
    for (;;) {
        const response = await request();
        if (response.ok) {
            return response;
        }
        const bodyText = await response.clone().text();
        if (attempt >= exports.RATE_LIMIT_MAX_RETRIES ||
            !(0, exports.hasRateLimitSignals)(response.status, response.headers, bodyText)) {
            return response;
        }
        const elapsedMs = now() - startMs;
        const backoffMs = (0, exports.computeBoundedBackoffMs)(response.headers, attempt, elapsedMs);
        if (backoffMs <= 0) {
            return response;
        }
        console.log(`GitHub returned ${response.status} (rate limit). Backing off ${backoffMs}ms before retry ${attempt + 1}/${exports.RATE_LIMIT_MAX_RETRIES}.`);
        await sleep(backoffMs);
        attempt++;
    }
};
exports.fetchWithGitHubRateLimitRetry = fetchWithGitHubRateLimitRetry;
//# sourceMappingURL=githubRateLimitRetry.js.map