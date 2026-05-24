import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import {
  SqliteClaudeMessageResponseRepository,
  generateUlid,
} from './SqliteClaudeMessageResponseRepository';
import { ClaudeMessageResponse } from '../../domain/entities/ClaudeMessageResponse';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const requireRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value))
    throw new Error(`Expected record, got: ${String(value)}`);
  return value;
};

const requireRecordArray = (value: unknown[]): Array<Record<string, unknown>> =>
  value.map(requireRecord);

const buildTestResponse = (
  overrides: Partial<ClaudeMessageResponse> = {},
): ClaudeMessageResponse => ({
  id: generateUlid(),
  observedAt: new Date('2024-01-15T10:30:00.000Z'),
  tokenName: 'hashed-token-abc',
  externalClaudeMessageId: 'msg_01XFDUDYJgAACTvykiHMn8xy',
  externalClaudeRequestId: 'req_01234',
  httpStatus: 200,
  model: 'claude-sonnet-4-5',
  role: 'assistant',
  stopReason: 'end_turn',
  stopSequence: null,
  inputTokens: 100,
  outputTokens: 50,
  cacheCreationInputTokens: null,
  cacheReadInputTokens: null,
  ephemeral5mInputTokens: null,
  ephemeral1hInputTokens: null,
  serviceTier: 'standard',
  inferenceGeo: null,
  errorType: null,
  errorMessage: null,
  anthropicRatelimitUnifiedStatus: 'active',
  anthropicRatelimitUnified5hStatus: 'active',
  anthropicRatelimitUnified5hUtilization: 42.5,
  anthropicRatelimitUnified5hReset: 1705316200,
  anthropicRatelimitUnified7dStatus: 'active',
  anthropicRatelimitUnified7dUtilization: 10.0,
  anthropicRatelimitUnified7dReset: 1705920000,
  retryAfter: null,
  anthropicOrganizationId: 'org-abc123',
  ...overrides,
});

describe('generateUlid', () => {
  it('generates a 26-character uppercase alphanumeric string', () => {
    const ulid = generateUlid();
    expect(ulid).toHaveLength(26);
    expect(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(ulid)).toBe(true);
  });

  it('generates unique values across multiple calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUlid()));
    expect(ids.size).toBe(100);
  });

  it('generates a value whose first 10 characters encode a timestamp no later than the current time', () => {
    const before = Date.now();
    const ulid = generateUlid();
    const after = Date.now();
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const timeChars = ulid.slice(0, 10);
    let decoded = 0;
    for (const char of timeChars) {
      decoded = decoded * 32 + ENCODING.indexOf(char);
    }
    expect(decoded).toBeGreaterThanOrEqual(before);
    expect(decoded).toBeLessThanOrEqual(after);
  });
});

describe('SqliteClaudeMessageResponseRepository', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-msg-repo-test-'));
    dbPath = path.join(tmpDir, 'claude_message_response.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('creates the database file when it does not exist', () => {
      new SqliteClaudeMessageResponseRepository(dbPath);
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('creates the parent directory when it does not exist', () => {
      const nestedDbPath = path.join(tmpDir, 'nested', 'dir', 'test.db');
      new SqliteClaudeMessageResponseRepository(nestedDbPath);
      expect(fs.existsSync(nestedDbPath)).toBe(true);
    });

    it('creates the claude_message_response table on first open', () => {
      new SqliteClaudeMessageResponseRepository(dbPath);
      const db = new Database(dbPath);
      const row = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='claude_message_response'",
        )
        .get();
      db.close();
      expect(row).toBeDefined();
    });

    it('does not fail when reopened against an existing database', () => {
      new SqliteClaudeMessageResponseRepository(dbPath);
      expect(() => {
        new SqliteClaudeMessageResponseRepository(dbPath);
      }).not.toThrow();
    });
  });

  describe('append', () => {
    it('inserts a row with all fields set', () => {
      const repo = new SqliteClaudeMessageResponseRepository(dbPath);
      const response = buildTestResponse();

      repo.append(response);

      const db = new Database(dbPath);
      const row = requireRecord(
        db
          .prepare('SELECT * FROM claude_message_response WHERE id = ?')
          .get(response.id),
      );
      db.close();

      expect(row['id']).toBe(response.id);
      expect(row['observed_at']).toBe(response.observedAt.getTime());
      expect(row['token_name']).toBe(response.tokenName);
      expect(row['external_claude_message_id']).toBe(
        response.externalClaudeMessageId,
      );
      expect(row['external_claude_request_id']).toBe(
        response.externalClaudeRequestId,
      );
      expect(row['http_status']).toBe(response.httpStatus);
      expect(row['model']).toBe(response.model);
      expect(row['role']).toBe(response.role);
      expect(row['stop_reason']).toBe(response.stopReason);
      expect(row['stop_sequence']).toBeNull();
      expect(row['input_tokens']).toBe(response.inputTokens);
      expect(row['output_tokens']).toBe(response.outputTokens);
      expect(row['cache_creation_input_tokens']).toBeNull();
      expect(row['cache_read_input_tokens']).toBeNull();
      expect(row['ephemeral_5m_input_tokens']).toBeNull();
      expect(row['ephemeral_1h_input_tokens']).toBeNull();
      expect(row['service_tier']).toBe(response.serviceTier);
      expect(row['inference_geo']).toBeNull();
      expect(row['error_type']).toBeNull();
      expect(row['error_message']).toBeNull();
      expect(row['anthropic_ratelimit_unified_status']).toBe(
        response.anthropicRatelimitUnifiedStatus,
      );
      expect(row['anthropic_ratelimit_unified_5h_status']).toBe(
        response.anthropicRatelimitUnified5hStatus,
      );
      expect(row['anthropic_ratelimit_unified_5h_utilization']).toBe(
        response.anthropicRatelimitUnified5hUtilization,
      );
      expect(row['anthropic_ratelimit_unified_5h_reset']).toBe(
        response.anthropicRatelimitUnified5hReset,
      );
      expect(row['anthropic_ratelimit_unified_7d_status']).toBe(
        response.anthropicRatelimitUnified7dStatus,
      );
      expect(row['anthropic_ratelimit_unified_7d_utilization']).toBe(
        response.anthropicRatelimitUnified7dUtilization,
      );
      expect(row['anthropic_ratelimit_unified_7d_reset']).toBe(
        response.anthropicRatelimitUnified7dReset,
      );
      expect(row['retry_after']).toBeNull();
      expect(row['anthropic_organization_id']).toBe(
        response.anthropicOrganizationId,
      );
    });

    it('inserts a row where all nullable fields are null', () => {
      const repo = new SqliteClaudeMessageResponseRepository(dbPath);
      const response = buildTestResponse({
        externalClaudeMessageId: null,
        externalClaudeRequestId: null,
        model: null,
        role: null,
        stopReason: null,
        stopSequence: null,
        inputTokens: null,
        outputTokens: null,
        cacheCreationInputTokens: null,
        cacheReadInputTokens: null,
        ephemeral5mInputTokens: null,
        ephemeral1hInputTokens: null,
        serviceTier: null,
        inferenceGeo: null,
        errorType: null,
        errorMessage: null,
        anthropicRatelimitUnifiedStatus: null,
        anthropicRatelimitUnified5hStatus: null,
        anthropicRatelimitUnified5hUtilization: null,
        anthropicRatelimitUnified5hReset: null,
        anthropicRatelimitUnified7dStatus: null,
        anthropicRatelimitUnified7dUtilization: null,
        anthropicRatelimitUnified7dReset: null,
        retryAfter: null,
        anthropicOrganizationId: null,
      });

      repo.append(response);

      const db = new Database(dbPath);
      const row = requireRecord(
        db
          .prepare('SELECT * FROM claude_message_response WHERE id = ?')
          .get(response.id),
      );
      db.close();

      expect(row['id']).toBe(response.id);
      expect(row['http_status']).toBe(response.httpStatus);
      expect(row['external_claude_message_id']).toBeNull();
      expect(row['model']).toBeNull();
    });

    it('inserts an error response with error fields set', () => {
      const repo = new SqliteClaudeMessageResponseRepository(dbPath);
      const response = buildTestResponse({
        httpStatus: 429,
        model: null,
        role: null,
        stopReason: null,
        inputTokens: null,
        outputTokens: null,
        errorType: 'rate_limit_error',
        errorMessage: 'Too many requests',
        retryAfter: 30,
      });

      repo.append(response);

      const db = new Database(dbPath);
      const row = requireRecord(
        db
          .prepare('SELECT * FROM claude_message_response WHERE id = ?')
          .get(response.id),
      );
      db.close();

      expect(row['http_status']).toBe(429);
      expect(row['error_type']).toBe('rate_limit_error');
      expect(row['error_message']).toBe('Too many requests');
      expect(row['retry_after']).toBe(30);
    });

    it('inserts multiple rows appending each independently', () => {
      const repo = new SqliteClaudeMessageResponseRepository(dbPath);
      const responses = [
        buildTestResponse({ httpStatus: 200 }),
        buildTestResponse({ httpStatus: 429 }),
        buildTestResponse({ httpStatus: 200 }),
      ];

      for (const response of responses) {
        repo.append(response);
      }

      const db = new Database(dbPath);
      const rows = requireRecordArray(
        db.prepare('SELECT id FROM claude_message_response').all(),
      );
      db.close();

      expect(rows).toHaveLength(3);
      const rowIds = rows.map((r) => r['id']).sort();
      const responseIds = responses.map((r) => r.id).sort();
      expect(rowIds).toEqual(responseIds);
    });

    it('persists rows that survive a repository close and reopen', () => {
      const firstRepo = new SqliteClaudeMessageResponseRepository(dbPath);
      const response = buildTestResponse();
      firstRepo.append(response);

      const secondRepo = new SqliteClaudeMessageResponseRepository(dbPath);

      const db = new Database(dbPath);
      const countRow = requireRecord(
        db.prepare('SELECT COUNT(*) as cnt FROM claude_message_response').get(),
      );
      db.close();

      expect(countRow['cnt']).toBe(1);
      expect(secondRepo).toBeDefined();
    });
  });
});
