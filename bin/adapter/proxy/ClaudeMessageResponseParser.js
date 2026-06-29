"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseClaudeMessageResponse = void 0;
const SqliteClaudeMessageResponseRepository_1 = require("../repositories/SqliteClaudeMessageResponseRepository");
const pickHeader = (headers, key) => {
    const value = headers[key];
    if (Array.isArray(value))
        return value[0] ?? null;
    return value ?? null;
};
const parseNullableFloat = (value) => {
    if (value === null)
        return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const parseNullableInt = (value) => {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string')
        return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
};
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const extractUsage = (body) => {
    const usage = body['usage'];
    if (!isRecord(usage)) {
        return {
            inputTokens: null,
            outputTokens: null,
            cacheCreationInputTokens: null,
            cacheReadInputTokens: null,
            ephemeral5mInputTokens: null,
            ephemeral1hInputTokens: null,
        };
    }
    return {
        inputTokens: parseNullableInt(usage['input_tokens']),
        outputTokens: parseNullableInt(usage['output_tokens']),
        cacheCreationInputTokens: parseNullableInt(usage['cache_creation_input_tokens']),
        cacheReadInputTokens: parseNullableInt(usage['cache_read_input_tokens']),
        ephemeral5mInputTokens: parseNullableInt(usage['ephemeral_5m_input_tokens']),
        ephemeral1hInputTokens: parseNullableInt(usage['ephemeral_1h_input_tokens']),
    };
};
const extractRole = (body) => {
    const role = body['role'];
    return typeof role === 'string' ? role : null;
};
const extractFirstContentRole = (body) => {
    const content = body['content'];
    if (!Array.isArray(content))
        return null;
    const first = content[0];
    if (!isRecord(first))
        return null;
    const role = first['role'];
    return typeof role === 'string' ? role : null;
};
const parseClaudeMessageResponse = (tokenName, httpStatus, headers, body) => {
    let parsedBody = {};
    try {
        const parsed = JSON.parse(body);
        if (isRecord(parsed)) {
            parsedBody = parsed;
        }
    }
    catch {
        parsedBody = {};
    }
    const errorObj = parsedBody['error'];
    const errorRecord = isRecord(errorObj) ? errorObj : null;
    const errorType = errorRecord !== null && typeof errorRecord['type'] === 'string'
        ? errorRecord['type']
        : null;
    const errorMessage = errorRecord !== null && typeof errorRecord['message'] === 'string'
        ? errorRecord['message']
        : null;
    const externalClaudeMessageId = typeof parsedBody['id'] === 'string' ? parsedBody['id'] : null;
    const model = typeof parsedBody['model'] === 'string' ? parsedBody['model'] : null;
    const role = extractRole(parsedBody) ?? extractFirstContentRole(parsedBody);
    const stopReason = typeof parsedBody['stop_reason'] === 'string'
        ? parsedBody['stop_reason']
        : null;
    const stopSequence = typeof parsedBody['stop_sequence'] === 'string'
        ? parsedBody['stop_sequence']
        : null;
    const usage = extractUsage(parsedBody);
    const retryAfterRaw = pickHeader(headers, 'retry-after');
    const retryAfter = parseNullableFloat(retryAfterRaw);
    return {
        id: (0, SqliteClaudeMessageResponseRepository_1.generateUlid)(),
        observedAt: new Date(),
        tokenName,
        externalClaudeMessageId,
        externalClaudeRequestId: pickHeader(headers, 'x-request-id'),
        httpStatus,
        model,
        role,
        stopReason,
        stopSequence,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheCreationInputTokens: usage.cacheCreationInputTokens,
        cacheReadInputTokens: usage.cacheReadInputTokens,
        ephemeral5mInputTokens: usage.ephemeral5mInputTokens,
        ephemeral1hInputTokens: usage.ephemeral1hInputTokens,
        serviceTier: pickHeader(headers, 'anthropic-service-tier'),
        inferenceGeo: pickHeader(headers, 'anthropic-inference-geo'),
        errorType,
        errorMessage,
        anthropicRatelimitUnifiedStatus: pickHeader(headers, 'anthropic-ratelimit-unified-status'),
        anthropicRatelimitUnified5hStatus: pickHeader(headers, 'anthropic-ratelimit-unified-5h-status'),
        anthropicRatelimitUnified5hUtilization: parseNullableFloat(pickHeader(headers, 'anthropic-ratelimit-unified-5h-utilization')),
        anthropicRatelimitUnified5hReset: parseNullableFloat(pickHeader(headers, 'anthropic-ratelimit-unified-5h-reset')),
        anthropicRatelimitUnified7dStatus: pickHeader(headers, 'anthropic-ratelimit-unified-7d-status'),
        anthropicRatelimitUnified7dUtilization: parseNullableFloat(pickHeader(headers, 'anthropic-ratelimit-unified-7d-utilization')),
        anthropicRatelimitUnified7dReset: parseNullableFloat(pickHeader(headers, 'anthropic-ratelimit-unified-7d-reset')),
        retryAfter,
        anthropicOrganizationId: pickHeader(headers, 'anthropic-organization-id'),
    };
};
exports.parseClaudeMessageResponse = parseClaudeMessageResponse;
//# sourceMappingURL=ClaudeMessageResponseParser.js.map