import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  cacheDir,
  cachePathForToken,
  hashToken,
  HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS,
  HEADERLESS_429_MAX_COOLDOWN_SECONDS,
  parseModelRateLimitsFromBody,
  parseModelRateLimitsFromHeaders,
  readRateLimit,
  writeModelRateLimit,
  writeRateLimit,
  writeSubscriptionDisabled,
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

    it('should surface the raw unified status and overage-disabled reason headers', () => {
      const token = 'unified-status-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed_warning',
        'anthropic-ratelimit-unified-overage-disabled-reason': 'out_of_credits',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '50',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '40',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.unifiedStatus).toBe('allowed_warning');
      expect(snapshot?.overageDisabledReason).toBe('out_of_credits');
    });

    it('should expose null for the unified status and overage-disabled reason when absent', () => {
      const token = 'no-unified-status-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '50',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '40',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.unifiedStatus).toBeNull();
      expect(snapshot?.overageDisabledReason).toBeNull();
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

    it('should expose ts as lastUpdatedEpoch in the snapshot', () => {
      const token = 'ts-snapshot-token';
      const before = Date.now() / 1000;
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
      });
      const after = Date.now() / 1000;
      const snapshot = readRateLimit(token);
      expect(snapshot).not.toBeNull();
      if (snapshot === null) return;
      expect(snapshot.lastUpdatedEpoch).toBeGreaterThanOrEqual(before);
      expect(snapshot.lastUpdatedEpoch).toBeLessThanOrEqual(after);
    });

    it('should default lastUpdatedEpoch to 0 when the stored payload has no ts field', () => {
      const token = 'no-ts-token';
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(
        cachePathForToken(token),
        JSON.stringify({
          headers: {
            'anthropic-ratelimit-unified-status': 'allowed',
            'anthropic-ratelimit-unified-5h-status': 'allowed',
            'anthropic-ratelimit-unified-5h-reset': '1700000000',
            'anthropic-ratelimit-unified-5h-utilization': '10',
            'anthropic-ratelimit-unified-7d-status': 'allowed',
            'anthropic-ratelimit-unified-7d-reset': '1700100000',
            'anthropic-ratelimit-unified-7d-utilization': '5',
          },
        }),
      );
      const snapshot = readRateLimit(token);
      expect(snapshot).not.toBeNull();
      if (snapshot === null) return;
      expect(snapshot.lastUpdatedEpoch).toBe(0);
    });
  });

  describe('writeRateLimit stores all anthropic-ratelimit-* headers', () => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);

    const readStoredHeaders = (token: string): Record<string, unknown> => {
      const filePath = cachePathForToken(token);
      const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (isRecord(raw) && isRecord(raw.headers)) {
        return raw.headers;
      }
      return {};
    };

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
      const storedHeaders = readStoredHeaders(token);
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
      const storedHeaders = readStoredHeaders(token);
      expect(storedHeaders['x-request-id']).toBeUndefined();
      expect(storedHeaders['content-type']).toBeUndefined();
      expect(storedHeaders['transfer-encoding']).toBeUndefined();
    });
  });

  describe('writeRateLimit preserves previous values when response has no anthropic-ratelimit-* headers', () => {
    it('should not write any file when no previous cache exists and headers contain no anthropic-ratelimit-*', () => {
      const token = '429-no-headers-no-prior-token';
      writeRateLimit(token, {
        'content-type': 'application/json',
      });
      expect(fs.existsSync(cachePathForToken(token))).toBe(false);
      expect(readRateLimit(token)).toBeNull();
    });

    it('should preserve the previous cache when a later response carries no anthropic-ratelimit-* headers (429 without headers)', () => {
      const token = '429-no-headers-with-prior-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '42',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '17',
      });
      const beforeContent = fs.readFileSync(cachePathForToken(token), 'utf8');
      writeRateLimit(token, {
        'content-type': 'application/json',
        'anthropic-organization-id': 'org-1',
      });
      const afterContent = fs.readFileSync(cachePathForToken(token), 'utf8');
      expect(afterContent).toBe(beforeContent);
      const snapshot = readRateLimit(token);
      expect(snapshot?.fiveHourUtilization).toBe(42);
      expect(snapshot?.fiveHourReset).toBe(1700000000);
      expect(snapshot?.sevenDayUtilization).toBe(17);
      expect(snapshot?.sevenDayReset).toBe(1700100000);
      expect(snapshot?.unifiedRejected).toBe(false);
      expect(snapshot?.fiveHourRejected).toBe(false);
      expect(snapshot?.sevenDayRejected).toBe(false);
      expect(snapshot?.blocked).toBe(false);
      expect(snapshot?.rejected).toBe(false);
    });

    it('should overwrite the previous cache when the response carries anthropic-ratelimit-* headers regardless of status code (429 with headers)', () => {
      const token = '429-with-headers-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '42',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '17',
      });
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'rejected',
        'anthropic-ratelimit-unified-5h-status': 'rejected',
        'anthropic-ratelimit-unified-5h-reset': '1700050000',
        'anthropic-ratelimit-unified-5h-utilization': '100',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '60',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.unifiedRejected).toBe(true);
      expect(snapshot?.fiveHourRejected).toBe(true);
      expect(snapshot?.fiveHourUtilization).toBe(100);
      expect(snapshot?.fiveHourReset).toBe(1700050000);
      expect(snapshot?.sevenDayUtilization).toBe(60);
    });

    it('should overwrite the previous cache when a 200 response carries anthropic-ratelimit-* headers (200 with headers)', () => {
      const token = '200-with-headers-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'rejected',
        'anthropic-ratelimit-unified-5h-status': 'rejected',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '100',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '60',
      });
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700050000',
        'anthropic-ratelimit-unified-5h-utilization': '30',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '20',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.unifiedRejected).toBe(false);
      expect(snapshot?.fiveHourRejected).toBe(false);
      expect(snapshot?.fiveHourUtilization).toBe(30);
      expect(snapshot?.fiveHourReset).toBe(1700050000);
      expect(snapshot?.sevenDayUtilization).toBe(20);
      expect(snapshot?.rejected).toBe(false);
    });

    it('should not modify any header value based on response status code', () => {
      const token = 'no-status-based-mutation-token';
      const inputHeaders: Record<string, string> = {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '42',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '17',
      };
      writeRateLimit(token, inputHeaders);
      const raw: unknown = JSON.parse(
        fs.readFileSync(cachePathForToken(token), 'utf8'),
      );
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value);
      if (!isRecord(raw) || !isRecord(raw.headers)) {
        throw new Error('expected stored cache to contain headers object');
      }
      for (const [key, expectedValue] of Object.entries(inputHeaders)) {
        expect(raw.headers[key]).toBe(expectedValue);
      }
    });
  });

  describe('writeRateLimit records a cooldown on a 429 with no anthropic-ratelimit-* headers', () => {
    it('should set blockedUntilEpoch using the default cooldown when no Retry-After header is present', () => {
      const token = '429-no-headers-default-cooldown-token';
      const before = Date.now() / 1000;
      writeRateLimit(token, { 'content-type': 'application/json' }, 429);
      const after = Date.now() / 1000;
      const snapshot = readRateLimit(token);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.blockedUntilEpoch).toBeGreaterThanOrEqual(
        before + HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS,
      );
      expect(snapshot?.blockedUntilEpoch).toBeLessThanOrEqual(
        after + HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS,
      );
    });

    it('should honor the Retry-After header when present', () => {
      const token = '429-no-headers-retry-after-token';
      const retryAfterSeconds = 120;
      const before = Date.now() / 1000;
      writeRateLimit(
        token,
        { 'content-type': 'application/json', 'retry-after': '120' },
        429,
      );
      const after = Date.now() / 1000;
      const snapshot = readRateLimit(token);
      expect(snapshot?.blockedUntilEpoch).toBeGreaterThanOrEqual(
        before + retryAfterSeconds,
      );
      expect(snapshot?.blockedUntilEpoch).toBeLessThanOrEqual(
        after + retryAfterSeconds,
      );
    });

    it('should clamp the cooldown to the maximum when Retry-After is very large', () => {
      const token = '429-no-headers-clamp-token';
      const before = Date.now() / 1000;
      writeRateLimit(
        token,
        { 'content-type': 'application/json', 'retry-after': '99999' },
        429,
      );
      const after = Date.now() / 1000;
      const snapshot = readRateLimit(token);
      expect(snapshot?.blockedUntilEpoch).toBeGreaterThanOrEqual(
        before + HEADERLESS_429_MAX_COOLDOWN_SECONDS,
      );
      expect(snapshot?.blockedUntilEpoch).toBeLessThanOrEqual(
        after + HEADERLESS_429_MAX_COOLDOWN_SECONDS,
      );
    });

    it('should preserve the previous last-good snapshot while adding the cooldown', () => {
      const token = '429-no-headers-preserve-snapshot-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '42',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '17',
      });
      writeRateLimit(token, { 'content-type': 'application/json' }, 429);
      const snapshot = readRateLimit(token);
      expect(snapshot?.fiveHourUtilization).toBe(42);
      expect(snapshot?.fiveHourReset).toBe(1700000000);
      expect(snapshot?.sevenDayUtilization).toBe(17);
      expect(snapshot?.sevenDayReset).toBe(1700100000);
      expect(snapshot?.rejected).toBe(false);
      expect(snapshot?.blocked).toBe(false);
      expect(snapshot?.blockedUntilEpoch).toBeGreaterThan(Date.now() / 1000);
    });

    it('should clear the cooldown when a later header-bearing response arrives', () => {
      const token = '429-then-normal-clears-cooldown-token';
      writeRateLimit(token, { 'content-type': 'application/json' }, 429);
      expect(readRateLimit(token)?.blockedUntilEpoch).toBeGreaterThan(
        Date.now() / 1000,
      );
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '30',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '20',
      });
      expect(readRateLimit(token)?.blockedUntilEpoch).toBe(0);
    });

    it('should not write any cooldown for a headerless response that is not a 429', () => {
      const token = '500-no-headers-no-cooldown-token';
      writeRateLimit(token, { 'content-type': 'application/json' }, 500);
      expect(fs.existsSync(cachePathForToken(token))).toBe(false);
      expect(readRateLimit(token)).toBeNull();
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

  describe('parseModelRateLimitsFromHeaders', () => {
    it('should extract a rejected seven_day_sonnet limit from the per-model unified headers', () => {
      expect(
        parseModelRateLimitsFromHeaders({
          'anthropic-ratelimit-unified-7d_sonnet-status': 'rejected',
          'anthropic-ratelimit-unified-7d_sonnet-reset': '1779642000',
        }),
      ).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
    });

    it('should extract both seven_day_sonnet and seven_day_opus limits with their statuses', () => {
      expect(
        parseModelRateLimitsFromHeaders({
          'anthropic-ratelimit-unified-7d_sonnet-status': 'rejected',
          'anthropic-ratelimit-unified-7d_sonnet-reset': '1779642000',
          'anthropic-ratelimit-unified-7d_opus-status': 'allowed',
          'anthropic-ratelimit-unified-7d_opus-reset': '1779700000',
        }),
      ).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
        seven_day_opus: { rejected: false, resetsAt: 1779700000 },
      });
    });

    it('should return an empty map when no per-model headers are present', () => {
      expect(
        parseModelRateLimitsFromHeaders({
          'anthropic-ratelimit-unified-status': 'allowed',
          'anthropic-ratelimit-unified-7d-status': 'allowed',
        }),
      ).toEqual({});
    });

    it('should default resetsAt to 0 when the per-model reset header is missing', () => {
      expect(
        parseModelRateLimitsFromHeaders({
          'anthropic-ratelimit-unified-7d_opus-status': 'rejected',
        }),
      ).toEqual({
        seven_day_opus: { rejected: true, resetsAt: 0 },
      });
    });
  });

  describe('readRateLimit per-model header population', () => {
    it('should populate seven_day_sonnet from the per-model headers when the body carried no rate_limit event', () => {
      const token = 'header-only-sonnet-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'rejected',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '53',
        'anthropic-ratelimit-unified-7d-status': 'allowed_warning',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '88',
        'anthropic-ratelimit-unified-7d_sonnet-status': 'rejected',
        'anthropic-ratelimit-unified-7d_sonnet-reset': '1779642000',
        'anthropic-ratelimit-unified-7d_opus-status': 'allowed',
        'anthropic-ratelimit-unified-7d_opus-reset': '1779700000',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
        seven_day_opus: { rejected: false, resetsAt: 1779700000 },
      });
      expect(snapshot?.unifiedRejected).toBe(true);
      expect(snapshot?.fiveHourRejected).toBe(false);
    });

    it('should let a body-derived model limit override the per-model header value for the same claim', () => {
      const token = 'body-overrides-header-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '1700000000',
        'anthropic-ratelimit-unified-5h-utilization': '10',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '1700100000',
        'anthropic-ratelimit-unified-7d-utilization': '5',
        'anthropic-ratelimit-unified-7d_sonnet-status': 'allowed',
        'anthropic-ratelimit-unified-7d_sonnet-reset': '1700200000',
      });
      writeModelRateLimit(token, {
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.modelWeeklyLimits).toEqual({
        seven_day_sonnet: { rejected: true, resetsAt: 1779642000 },
      });
    });
  });

  describe('writeSubscriptionDisabled', () => {
    it('should persist subscriptionDisabledEpoch to the cache file', () => {
      const token = 'sub-disabled-token';
      writeSubscriptionDisabled(token);
      const filePath = cachePathForToken(token);
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      expect(parsed).toMatchObject({
        subscriptionDisabledEpoch: expect.any(Number),
      });
    });

    it('should preserve existing cache fields when writing subscriptionDisabledEpoch', () => {
      const token = 'sub-disabled-preserve-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '2000100',
        'anthropic-ratelimit-unified-5h-utilization': '0.1',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '2000200',
        'anthropic-ratelimit-unified-7d-utilization': '0.1',
      });
      writeSubscriptionDisabled(token);
      const snapshot = readRateLimit(token);
      expect(snapshot?.subscriptionDisabled).toBe(true);
      expect(snapshot?.fiveHourReset).toBe(2000100);
    });
  });

  describe('readRateLimit subscriptionDisabled', () => {
    it('returns subscriptionDisabled: true after writeSubscriptionDisabled is called', () => {
      const token = 'sub-disabled-read-token';
      writeSubscriptionDisabled(token);
      const snapshot = readRateLimit(token);
      expect(snapshot?.subscriptionDisabled).toBe(true);
    });

    it('returns subscriptionDisabled: false when no subscriptionDisabledEpoch is in the cache', () => {
      const token = 'sub-not-disabled-token';
      writeRateLimit(token, {
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': '2000100',
        'anthropic-ratelimit-unified-5h-utilization': '0.1',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': '2000200',
        'anthropic-ratelimit-unified-7d-utilization': '0.1',
      });
      const snapshot = readRateLimit(token);
      expect(snapshot?.subscriptionDisabled).toBe(false);
    });
  });
});
