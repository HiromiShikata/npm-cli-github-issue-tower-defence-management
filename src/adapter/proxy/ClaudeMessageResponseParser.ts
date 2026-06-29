import * as http from 'http';
import { ClaudeMessageResponse } from '../../domain/entities/ClaudeMessageResponse';
import { generateUlid } from '../repositories/SqliteClaudeMessageResponseRepository';

const pickHeader = (
  headers: http.IncomingHttpHeaders,
  key: string,
): string | null => {
  const value = headers[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const parseNullableFloat = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNullableInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === 'number'
      ? value
      : parseInt(typeof value === 'string' ? value : JSON.stringify(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const extractUsage = (
  body: Record<string, unknown>,
): {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  ephemeral5mInputTokens: number | null;
  ephemeral1hInputTokens: number | null;
} => {
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
    cacheCreationInputTokens: parseNullableInt(
      usage['cache_creation_input_tokens'],
    ),
    cacheReadInputTokens: parseNullableInt(usage['cache_read_input_tokens']),
    ephemeral5mInputTokens: parseNullableInt(
      usage['ephemeral_5m_input_tokens'],
    ),
    ephemeral1hInputTokens: parseNullableInt(
      usage['ephemeral_1h_input_tokens'],
    ),
  };
};

const extractRole = (body: Record<string, unknown>): string | null => {
  const role = body['role'];
  return typeof role === 'string' ? role : null;
};

const extractFirstContentRole = (
  body: Record<string, unknown>,
): string | null => {
  const content = body['content'];
  if (!Array.isArray(content)) return null;
  const first: unknown = content[0];
  if (!isRecord(first)) return null;
  const role = first['role'];
  return typeof role === 'string' ? role : null;
};

export const parseClaudeMessageResponse = (
  tokenName: string,
  httpStatus: number,
  headers: http.IncomingHttpHeaders,
  body: string,
): ClaudeMessageResponse => {
  let parsedBody: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed)) {
      parsedBody = parsed;
    }
  } catch {
    parsedBody = {};
  }

  const errorObj = parsedBody['error'];
  const errorRecord = isRecord(errorObj) ? errorObj : null;
  const errorType =
    errorRecord !== null && typeof errorRecord['type'] === 'string'
      ? errorRecord['type']
      : null;
  const errorMessage =
    errorRecord !== null && typeof errorRecord['message'] === 'string'
      ? errorRecord['message']
      : null;

  const externalClaudeMessageId =
    typeof parsedBody['id'] === 'string' ? parsedBody['id'] : null;

  const model =
    typeof parsedBody['model'] === 'string' ? parsedBody['model'] : null;

  const role = extractRole(parsedBody) ?? extractFirstContentRole(parsedBody);

  const stopReason =
    typeof parsedBody['stop_reason'] === 'string'
      ? parsedBody['stop_reason']
      : null;
  const stopSequence =
    typeof parsedBody['stop_sequence'] === 'string'
      ? parsedBody['stop_sequence']
      : null;

  const usage = extractUsage(parsedBody);

  const retryAfterRaw = pickHeader(headers, 'retry-after');
  const retryAfter = parseNullableFloat(retryAfterRaw);

  return {
    id: generateUlid(),
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
    anthropicRatelimitUnifiedStatus: pickHeader(
      headers,
      'anthropic-ratelimit-unified-status',
    ),
    anthropicRatelimitUnified5hStatus: pickHeader(
      headers,
      'anthropic-ratelimit-unified-5h-status',
    ),
    anthropicRatelimitUnified5hUtilization: parseNullableFloat(
      pickHeader(headers, 'anthropic-ratelimit-unified-5h-utilization'),
    ),
    anthropicRatelimitUnified5hReset: parseNullableFloat(
      pickHeader(headers, 'anthropic-ratelimit-unified-5h-reset'),
    ),
    anthropicRatelimitUnified7dStatus: pickHeader(
      headers,
      'anthropic-ratelimit-unified-7d-status',
    ),
    anthropicRatelimitUnified7dUtilization: parseNullableFloat(
      pickHeader(headers, 'anthropic-ratelimit-unified-7d-utilization'),
    ),
    anthropicRatelimitUnified7dReset: parseNullableFloat(
      pickHeader(headers, 'anthropic-ratelimit-unified-7d-reset'),
    ),
    retryAfter,
    anthropicOrganizationId: pickHeader(headers, 'anthropic-organization-id'),
  };
};
