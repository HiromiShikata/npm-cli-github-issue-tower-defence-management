import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  cacheDir,
  cachePathForToken,
  hashToken,
  parseModelRateLimitsFromBody,
  readRateLimit,
  writeModelRateLimit,
  writeRateLimit,
} from './RateLimitCache';

describe('RateLimitCache', () => {
  let tempDir: string;
  const originalXdg = process.env.XDG_CACHE_HOME;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratelimit-cache-'));
    process.env.XDG_CACHE_HOME = tempDir;
  });

  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalXdg;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('hashToken', () => {
    it('should be deterministic for the same input', () => {
      expect(hashToken('token-a')).toBe(hashToken('token-a'));
    });

    it('should differ for different inputs', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });

    it('should return a 64-character hex string for sha256', () => {
      const hash = hashToken('token-a');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('cacheDir', () => {
    it('should honor XDG_CACHE_HOME', () => {
      expect(cacheDir()).toBe(path.join(tempDir, 'tdpm', 'ratelimit'));
    });

    it('should default to ~/.cache when XDG_CACHE_HOME is unset', () => {
      delete process.env.XDG_CACHE_HOME;
      expect(cacheDir()).toBe(
        path.join(os.homedir(), '.cache', 'tdpm', 'ratelimit'),
      );
    });
  });

  describe('cachePathForToken', () => {
    it('should place the file under cacheDir with the token hash as filename', () => {
      const token = 'token-x';
      expect(cachePathForToken(token)).toBe(
        path.join(cacheDir(), `${hashToken(token)}.json`),
      );
    });
  });

  describe('writeRateLimit and readRateLimit', () => {
    it('should round-trip rate limit headers', () => {
      const token = 'roundtrip-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '42',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '17',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot).not.toBeNull();
      if (snapshot === null) return;
      expect(snapshot.fiveHourUtilization).toBe(42);
      expect(snapshot.fiveHourReset).toBe(1700000000);
      expect(snapshot.sevenDayUtilization).toBe(17);
      expect(snapshot.sevenDayReset).toBe(1700100000);
      expect(snapshot.blocked).toBe(false);
      expect(snapshot.rejected).toBe(false);
    });

    it('should mark snapshot as blocked when status header is blocked', () => {
      const token = 'blocked-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'blocked',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '100',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '99',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.blocked).toBe(true);
    });

    it('should mark snapshot as rejected when unified status header is rejected', () => {
      const token = 'rejected-unified-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'rejected',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '100',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '99',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.rejected).toBe(true);
      expect(snapshot?.blocked).toBe(false);
      expect(snapshot?.unifiedRejected).toBe(true);
      expect(snapshot?.fiveHourRejected).toBe(false);
      expect(snapshot?.sevenDayRejected).toBe(false);
    });

    it('should mark snapshot as rejected when 5h status header is rejected', () => {
      const token = 'rejected-5h-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'rejected',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '100',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '99',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.rejected).toBe(true);
      expect(snapshot?.fiveHourRejected).toBe(true);
      expect(snapshot?.sevenDayRejected).toBe(false);
      expect(snapshot?.unifiedRejected).toBe(false);
    });

    it('should mark snapshot as rejected when 7d status header is rejected', () => {
      const token = 'rejected-7d-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '50',
        'anthropic-ratelimit-unified-7d-status': 'rejected',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '100',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.rejected).toBe(true);
      expect(snapshot?.sevenDayRejected).toBe(true);
      expect(snapshot?.fiveHourRejected).toBe(false);
      expect(snapshot?.unifiedRejected).toBe(false);
    });

    it('should not mark snapshot as rejected when no status header is rejected', () => {
      const token = 'allowed-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '50',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '40',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.rejected).toBe(false);
      expect(snapshot?.unifiedRejected).toBe(false);
      expect(snapshot?.fiveHourRejected).toBe(false);
      expect(snapshot?.sevenDayRejected).toBe(false);
    });

    it('should return null when file does not exist', () => {
      expect(readRateLimit('never-written-token')).toBeNull();
    });

    it('should return null when file content is malformed JSON', () => {
      const token = 'malformed-token';
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(cachePathForToken(token), '{not json');
      expect(readRateLimit(token)).toBeNull();
    });

    it('should treat array header values as the first element', () => {
      const token = 'array-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': ['1700000000', 'ignored'],
        'anthropic-ratelimit-unified-5h-utilization': ['55', 'ignored'],
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '10',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.fiveHourUtilization).toBe(55);
      expect(snapshot?.fiveHourReset).toBe(1700000000);
    });

    it('should default modelWeeklyLimits to an empty object when none are recorded', () => {
      const token = 'no-model-limits-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({});
    });
  });

  describe('writeRateLimit stores all anthropic-ratelimit-* headers', () => {
    it('should store any anthropic-ratelimit-* header present in the response', () => {
      const token = 'extra-header-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
        'anthropic-ratelimit-unified-reset': '1700000000',
        'anthropic-ratelimit-requests-limit': '100',
        'anthropic-ratelimit-requests-remaining': '99',
        'content-type': 'application/json',
      });
      const filePath = cachePathForToken(token);
      const raw = JSON.parse(
        require('fs').readFileSync(filePath, 'utf8'),
      ) as Record<string, unknown>;
      const storedHeaders = raw.headers as Record<string, string>;
      expect(storedHeaders['anthropic-ratelimit-unified-reset']).toBe(
        '1700000000',
      );
      expect(storedHeaders['anthropic-ratelimit-requests-limit']).toBe('100');
      expect(storedHeaders['anthropic-ratelimit-requests-remaining']).toBe(
        '99',
      );
      expect(storedHeaders['content-type']).toBeUndefined();
    });

    it('should not store non-anthropic-ratelimit headers', () => {
      const token = 'non-ratelimit-header-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
        'x-request-id': 'abc123',
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      });
      const filePath = cachePathForToken(token);
      const raw = JSON.parse(
        require('fs').readFileSync(filePath, 'utf8'),
      ) as Record<string, unknown>;
      const storedHeaders = raw.headers as Record<string, string>;
      expect(storedHeaders['x-request-id']).toBeUndefined();
      expect(storedHeaders['content-type']).toBeUndefined();
      expect(storedHeaders['transfer-encoding']).toBeUndefined();
    });
  });

  describe('parseModelRateLimitsFromBody', () => {
    it('should extract a rejected seven_day_sonnet limit from a rate_limit event body', () => {
      const body =
        'event: error\n' +
        'data: {"status":"rejected","resetsAt":1779642000,"rateLimitType":"seven_day_sonnet","overageStatus":"rejected"}\n\n';
      expect(parseModelRateLimitsFromBody(body)).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
    });

    it('should extract multiple distinct rate limit types', () => {
      const body =
        'data: {"status":"rejected","resetsAt":1779642000,"rateLimitType":"seven_day_sonnet"}\n' +
        'data: {"status":"allowed","resetsAt":1779700000,"rateLimitType":"seven_day"}\n';
      expect(parseModelRateLimitsFromBody(body)).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
        seven_day: { rejected: false, resetsAt: 1779700000 },
      });
    });

    it('should return an empty object when no rate limit information is present', () => {
      const body =
        'event: message_start\n' +
        'data: {"type":"message_start","message":{"id":"msg_1"}}\n\n';
      expect(parseModelRateLimitsFromBody(body)).toEqual({});
    });

    it('should ignore entries that lack a numeric resetsAt', () => {
      const body =
        'data: {"status":"rejected","rateLimitType":"seven_day_sonnet"}\n';
      expect(parseModelRateLimitsFromBody(body)).toEqual({});
    });
  });

  describe('writeModelRateLimit', () => {
    it('should persist model weekly limits readable by readRateLimit', () => {
      const token = 'model-limit-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
      });
      writeModelRateLimit(token, {
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      expect(snapshot?.fiveHourUtilization).toBe(10);
    });

    it('should preserve previously recorded model limits when headers are rewritten', () => {
      const token = 'preserve-token';
      writeModelRateLimit(token, {
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '20',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      expect(snapshot?.fiveHourUtilization).toBe(20);
    });

    it('should merge new model limits with existing ones', () => {
      const token = 'merge-token';
      writeModelRateLimit(token, {
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      writeModelRateLimit(token, {
        seven_day: { rejected: false, resetsAt: 1779700000 },
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
        seven_day: { rejected: false, resetsAt: 1779700000 },
      });
    });

    it('should not write a file when there are no limits to record', () => {
      const token = 'empty-limits-token';
      writeModelRateLimit(token, {});
      expect(readRateLimit(token)).toBeNull();
    });
  });
});
