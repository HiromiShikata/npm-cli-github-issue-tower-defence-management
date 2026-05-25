import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeMessageResponse } from '../../domain/entities/ClaudeMessageResponse';
import { ClaudeMessageResponseRepository } from '../../domain/usecases/adapter-interfaces/ClaudeMessageResponseRepository';

const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const encodeUlidTime = (ms: number): string => {
  let str = '';
  for (let i = 9; i >= 0; i--) {
    str = ULID_ENCODING[ms % 32] + str;
    ms = Math.floor(ms / 32);
  }
  return str;
};

const encodeUlidRandom = (): string => {
  const bytes = crypto.randomBytes(10);
  let bits = 0;
  let bitLen = 0;
  let str = '';
  for (let i = 0; i < bytes.length && str.length < 16; i++) {
    bits = (bits << 8) | bytes[i];
    bitLen += 8;
    while (bitLen >= 5 && str.length < 16) {
      str += ULID_ENCODING[(bits >>> (bitLen - 5)) & 0x1f];
      bitLen -= 5;
    }
  }
  return str;
};

export const generateUlid = (): string =>
  encodeUlidTime(Date.now()) + encodeUlidRandom();

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS claude_message_response (
    id TEXT PRIMARY KEY,
    observed_at INTEGER NOT NULL,
    token_name TEXT NOT NULL,
    external_claude_message_id TEXT,
    external_claude_request_id TEXT,
    http_status INTEGER NOT NULL,
    model TEXT,
    role TEXT,
    stop_reason TEXT,
    stop_sequence TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_creation_input_tokens INTEGER,
    cache_read_input_tokens INTEGER,
    ephemeral_5m_input_tokens INTEGER,
    ephemeral_1h_input_tokens INTEGER,
    service_tier TEXT,
    inference_geo TEXT,
    error_type TEXT,
    error_message TEXT,
    anthropic_ratelimit_unified_status TEXT,
    anthropic_ratelimit_unified_5h_status TEXT,
    anthropic_ratelimit_unified_5h_utilization REAL,
    anthropic_ratelimit_unified_5h_reset REAL,
    anthropic_ratelimit_unified_7d_status TEXT,
    anthropic_ratelimit_unified_7d_utilization REAL,
    anthropic_ratelimit_unified_7d_reset REAL,
    retry_after REAL,
    anthropic_organization_id TEXT
  ) STRICT
`;

const INSERT_SQL = `
  INSERT INTO claude_message_response (
    id, observed_at, token_name,
    external_claude_message_id, external_claude_request_id,
    http_status, model, role, stop_reason, stop_sequence,
    input_tokens, output_tokens,
    cache_creation_input_tokens, cache_read_input_tokens,
    ephemeral_5m_input_tokens, ephemeral_1h_input_tokens,
    service_tier, inference_geo,
    error_type, error_message,
    anthropic_ratelimit_unified_status,
    anthropic_ratelimit_unified_5h_status,
    anthropic_ratelimit_unified_5h_utilization,
    anthropic_ratelimit_unified_5h_reset,
    anthropic_ratelimit_unified_7d_status,
    anthropic_ratelimit_unified_7d_utilization,
    anthropic_ratelimit_unified_7d_reset,
    retry_after, anthropic_organization_id
  ) VALUES (
    @id, @observedAt, @tokenName,
    @externalClaudeMessageId, @externalClaudeRequestId,
    @httpStatus, @model, @role, @stopReason, @stopSequence,
    @inputTokens, @outputTokens,
    @cacheCreationInputTokens, @cacheReadInputTokens,
    @ephemeral5mInputTokens, @ephemeral1hInputTokens,
    @serviceTier, @inferenceGeo,
    @errorType, @errorMessage,
    @anthropicRatelimitUnifiedStatus,
    @anthropicRatelimitUnified5hStatus,
    @anthropicRatelimitUnified5hUtilization,
    @anthropicRatelimitUnified5hReset,
    @anthropicRatelimitUnified7dStatus,
    @anthropicRatelimitUnified7dUtilization,
    @anthropicRatelimitUnified7dReset,
    @retryAfter, @anthropicOrganizationId
  )
`;

export class SqliteClaudeMessageResponseRepository implements ClaudeMessageResponseRepository {
  private readonly db: Database.Database;
  private readonly insert: Database.Statement;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE_SQL);
    this.insert = this.db.prepare(INSERT_SQL);
  }

  append = (response: ClaudeMessageResponse): void => {
    this.insert.run({
      id: response.id,
      observedAt: response.observedAt.getTime(),
      tokenName: response.tokenName,
      externalClaudeMessageId: response.externalClaudeMessageId,
      externalClaudeRequestId: response.externalClaudeRequestId,
      httpStatus: response.httpStatus,
      model: response.model,
      role: response.role,
      stopReason: response.stopReason,
      stopSequence: response.stopSequence,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      cacheCreationInputTokens: response.cacheCreationInputTokens,
      cacheReadInputTokens: response.cacheReadInputTokens,
      ephemeral5mInputTokens: response.ephemeral5mInputTokens,
      ephemeral1hInputTokens: response.ephemeral1hInputTokens,
      serviceTier: response.serviceTier,
      inferenceGeo: response.inferenceGeo,
      errorType: response.errorType,
      errorMessage: response.errorMessage,
      anthropicRatelimitUnifiedStatus: response.anthropicRatelimitUnifiedStatus,
      anthropicRatelimitUnified5hStatus:
        response.anthropicRatelimitUnified5hStatus,
      anthropicRatelimitUnified5hUtilization:
        response.anthropicRatelimitUnified5hUtilization,
      anthropicRatelimitUnified5hReset:
        response.anthropicRatelimitUnified5hReset,
      anthropicRatelimitUnified7dStatus:
        response.anthropicRatelimitUnified7dStatus,
      anthropicRatelimitUnified7dUtilization:
        response.anthropicRatelimitUnified7dUtilization,
      anthropicRatelimitUnified7dReset:
        response.anthropicRatelimitUnified7dReset,
      retryAfter: response.retryAfter,
      anthropicOrganizationId: response.anthropicOrganizationId,
    });
  };
}
