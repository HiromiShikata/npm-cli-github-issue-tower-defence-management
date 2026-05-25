import { parseClaudeMessageResponse } from './ClaudeMessageResponseParser';

const SUCCESS_BODY = JSON.stringify({
  id: 'msg_01XFDUDYJgAACTvykiHMn8xy',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-4-5',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
  },
});

const ERROR_BODY = JSON.stringify({
  type: 'error',
  error: {
    type: 'rate_limit_error',
    message: 'Too many requests',
  },
});

const SUCCESS_HEADERS = {
  'x-request-id': 'req_01234',
  'anthropic-ratelimit-unified-status': 'active',
  'anthropic-ratelimit-unified-5h-status': 'active',
  'anthropic-ratelimit-unified-5h-utilization': '42.5',
  'anthropic-ratelimit-unified-5h-reset': '1705316200',
  'anthropic-ratelimit-unified-7d-status': 'active',
  'anthropic-ratelimit-unified-7d-utilization': '10.0',
  'anthropic-ratelimit-unified-7d-reset': '1705920000',
  'anthropic-organization-id': 'org-abc123',
  'anthropic-service-tier': 'standard',
};

describe('parseClaudeMessageResponse', () => {
  it('parses a successful 200 response with all fields', () => {
    const result = parseClaudeMessageResponse(
      'hashed-token',
      200,
      SUCCESS_HEADERS,
      SUCCESS_BODY,
    );

    expect(result.tokenName).toBe('hashed-token');
    expect(result.httpStatus).toBe(200);
    expect(result.externalClaudeMessageId).toBe('msg_01XFDUDYJgAACTvykiHMn8xy');
    expect(result.externalClaudeRequestId).toBe('req_01234');
    expect(result.model).toBe('claude-sonnet-4-5');
    expect(result.role).toBe('assistant');
    expect(result.stopReason).toBe('end_turn');
    expect(result.stopSequence).toBeNull();
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.cacheCreationInputTokens).toBeNull();
    expect(result.cacheReadInputTokens).toBeNull();
    expect(result.serviceTier).toBe('standard');
    expect(result.errorType).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.anthropicRatelimitUnifiedStatus).toBe('active');
    expect(result.anthropicRatelimitUnified5hStatus).toBe('active');
    expect(result.anthropicRatelimitUnified5hUtilization).toBe(42.5);
    expect(result.anthropicRatelimitUnified5hReset).toBe(1705316200);
    expect(result.anthropicRatelimitUnified7dStatus).toBe('active');
    expect(result.anthropicRatelimitUnified7dUtilization).toBe(10.0);
    expect(result.anthropicRatelimitUnified7dReset).toBe(1705920000);
    expect(result.retryAfter).toBeNull();
    expect(result.anthropicOrganizationId).toBe('org-abc123');
  });

  it('assigns a non-empty ULID as id', () => {
    const result = parseClaudeMessageResponse('tok', 200, {}, '{}');
    expect(result.id).toHaveLength(26);
    expect(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(result.id)).toBe(true);
  });

  it('sets observedAt to a recent Date', () => {
    const before = Date.now();
    const result = parseClaudeMessageResponse('tok', 200, {}, '{}');
    const after = Date.now();
    expect(result.observedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.observedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('parses an error response body', () => {
    const result = parseClaudeMessageResponse(
      'hashed-token',
      429,
      { 'retry-after': '30' },
      ERROR_BODY,
    );

    expect(result.httpStatus).toBe(429);
    expect(result.errorType).toBe('rate_limit_error');
    expect(result.errorMessage).toBe('Too many requests');
    expect(result.retryAfter).toBe(30);
    expect(result.model).toBeNull();
    expect(result.role).toBeNull();
    expect(result.stopReason).toBeNull();
    expect(result.inputTokens).toBeNull();
    expect(result.outputTokens).toBeNull();
  });

  it('returns null for missing body fields when body is empty object', () => {
    const result = parseClaudeMessageResponse('tok', 200, {}, '{}');

    expect(result.externalClaudeMessageId).toBeNull();
    expect(result.model).toBeNull();
    expect(result.role).toBeNull();
    expect(result.stopReason).toBeNull();
    expect(result.stopSequence).toBeNull();
    expect(result.inputTokens).toBeNull();
    expect(result.outputTokens).toBeNull();
  });

  it('returns null for rate limit headers when they are absent', () => {
    const result = parseClaudeMessageResponse('tok', 200, {}, '{}');

    expect(result.anthropicRatelimitUnifiedStatus).toBeNull();
    expect(result.anthropicRatelimitUnified5hStatus).toBeNull();
    expect(result.anthropicRatelimitUnified5hUtilization).toBeNull();
    expect(result.anthropicRatelimitUnified5hReset).toBeNull();
    expect(result.anthropicOrganizationId).toBeNull();
    expect(result.retryAfter).toBeNull();
  });

  it('handles non-JSON body gracefully by leaving body fields null', () => {
    const result = parseClaudeMessageResponse(
      'tok',
      200,
      {},
      'this is not json',
    );

    expect(result.externalClaudeMessageId).toBeNull();
    expect(result.model).toBeNull();
    expect(result.inputTokens).toBeNull();
  });

  it('handles empty body string gracefully', () => {
    const result = parseClaudeMessageResponse('tok', 200, {}, '');

    expect(result.externalClaudeMessageId).toBeNull();
    expect(result.model).toBeNull();
  });

  it('picks the first value when a header is an array', () => {
    const result = parseClaudeMessageResponse(
      'tok',
      200,
      { 'x-request-id': ['req-first', 'req-second'] },
      '{}',
    );

    expect(result.externalClaudeRequestId).toBe('req-first');
  });

  it('parses cache token fields from usage', () => {
    const body = JSON.stringify({
      id: 'msg_cache',
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 200,
        output_tokens: 80,
        cache_creation_input_tokens: 150,
        cache_read_input_tokens: 50,
      },
    });

    const result = parseClaudeMessageResponse('tok', 200, {}, body);

    expect(result.cacheCreationInputTokens).toBe(150);
    expect(result.cacheReadInputTokens).toBe(50);
  });

  it('parses ephemeral token fields from usage', () => {
    const body = JSON.stringify({
      id: 'msg_ephemeral',
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 300,
        output_tokens: 120,
        ephemeral_5m_input_tokens: 100,
        ephemeral_1h_input_tokens: 200,
      },
    });

    const result = parseClaudeMessageResponse('tok', 200, {}, body);

    expect(result.ephemeral5mInputTokens).toBe(100);
    expect(result.ephemeral1hInputTokens).toBe(200);
  });

  it('parses a non-finite utilization header as null', () => {
    const result = parseClaudeMessageResponse(
      'tok',
      200,
      { 'anthropic-ratelimit-unified-5h-utilization': 'not-a-number' },
      '{}',
    );

    expect(result.anthropicRatelimitUnified5hUtilization).toBeNull();
  });
});
