import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  cacheDir,
  cachePathForToken,
  hashToken,
  readRateLimit,
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
  });
});
