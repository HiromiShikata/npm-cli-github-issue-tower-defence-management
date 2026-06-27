import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hashToken } from '../../proxy/RateLimitCache';
import {
  OauthTokenSelectHandler,
  resolveCacheDirectory,
  resolveTokenListJsonPath,
} from './OauthTokenSelectHandler';

const NOW = 2_000_000;
const HOUR = 3600;
const DAY = 86400;

type FakeHeaders = {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
};

describe('OauthTokenSelectHandler', () => {
  let tempDir: string;
  let cacheDirectory: string;
  let tokenListPath: string;
  const originalTokenListEnv =
    process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;
  const originalCacheEnv = process.env.TDPM_RATELIMIT_CACHE_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'select-token-'));
    cacheDirectory = path.join(tempDir, 'cache');
    fs.mkdirSync(cacheDirectory, { recursive: true });
    tokenListPath = path.join(tempDir, 'tokens.json');
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;
    delete process.env.TDPM_RATELIMIT_CACHE_DIR;
  });

  afterEach(() => {
    if (originalTokenListEnv === undefined) {
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;
    } else {
      process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH = originalTokenListEnv;
    }
    if (originalCacheEnv === undefined) {
      delete process.env.TDPM_RATELIMIT_CACHE_DIR;
    } else {
      process.env.TDPM_RATELIMIT_CACHE_DIR = originalCacheEnv;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeTokenList = (entries: { name: string; token: string }[]): void => {
    fs.writeFileSync(tokenListPath, JSON.stringify(entries));
  };

  const writeCache = (token: string, headers: FakeHeaders): void => {
    const payload = {
      ts: NOW,
      headers: {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': String(headers.fiveHourReset),
        'anthropic-ratelimit-unified-5h-utilization': String(
          headers.fiveHourUtilization,
        ),
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': String(headers.sevenDayReset),
        'anthropic-ratelimit-unified-7d-utilization': String(
          headers.sevenDayUtilization,
        ),
      },
      modelWeeklyLimits: {},
    };
    fs.writeFileSync(
      path.join(cacheDirectory, `${hashToken(token)}.json`),
      JSON.stringify(payload),
    );
  };

  const writeSubscriptionDisabledCache = (
    token: string,
    epochSeconds: number = Date.now() / 1000,
  ): void => {
    const payload = { subscriptionDisabledEpoch: epochSeconds };
    fs.writeFileSync(
      path.join(cacheDirectory, `${hashToken(token)}.json`),
      JSON.stringify(payload),
    );
  };

  const writeCacheWithHeaders = (
    token: string,
    headers: Record<string, string>,
  ): void => {
    const payload = { ts: NOW, headers, modelWeeklyLimits: {} };
    fs.writeFileSync(
      path.join(cacheDirectory, `${hashToken(token)}.json`),
      JSON.stringify(payload),
    );
  };

  it('selects the eligible token with the soonest 7d reset', () => {
    writeTokenList([
      { name: 'far', token: 'fake-far' },
      { name: 'soon', token: 'fake-soon' },
    ]);
    writeCache('fake-far', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 6 * DAY,
    });
    writeCache('fake-soon', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 2 * DAY,
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('soon');
    expect(output.selectedToken).toBe('fake-soon');
  });

  it('treats a token with no cache file as fully free', () => {
    writeTokenList([{ name: 'fresh', token: 'fake-fresh' }]);

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('fresh');
  });

  it('returns null and a diagnostic when no token passes the filter', () => {
    writeTokenList([{ name: 'busy', token: 'fake-busy' }]);
    writeCache('fake-busy', {
      fiveHourUtilization: 0.9,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.diagnostics.join('\n')).toContain(
      'No eligible token passed the rate-limit filter.',
    );
  });

  it('returns a diagnostic when no token list path is resolvable', () => {
    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: null,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.diagnostics.join('\n')).toContain('No token list path');
  });

  it('returns a diagnostic when the token list file has no usable entries', () => {
    fs.writeFileSync(tokenListPath, JSON.stringify([]));

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.diagnostics.join('\n')).toContain('No usable token entries');
  });

  it('excludes a subscription-disabled token even when rate limits are fully free', () => {
    writeTokenList([
      { name: 'disabled', token: 'fake-disabled' },
      { name: 'active', token: 'fake-active' },
    ]);
    writeSubscriptionDisabledCache('fake-disabled');
    writeCache('fake-active', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('active');
    expect(output.diagnostics.join('\n')).toContain(
      'organization has disabled Claude subscription access for Claude Code',
    );
  });

  it('excludes a unified-rejected token even when rate limits are fully free', () => {
    writeTokenList([
      { name: 'rejected', token: 'fake-rejected' },
      { name: 'active', token: 'fake-active' },
    ]);
    writeCacheWithHeaders('fake-rejected', {
      'anthropic-ratelimit-unified-status': 'rejected',
      'anthropic-ratelimit-unified-5h-status': 'allowed',
      'anthropic-ratelimit-unified-5h-reset': String(NOW + HOUR),
      'anthropic-ratelimit-unified-5h-utilization': '0.1',
      'anthropic-ratelimit-unified-7d-status': 'allowed',
      'anthropic-ratelimit-unified-7d-reset': String(NOW + DAY),
      'anthropic-ratelimit-unified-7d-utilization': '0.1',
    });
    writeCache('fake-active', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('active');
    expect(output.diagnostics.join('\n')).toContain('rejected');
  });

  it('does not exclude a token solely because overage is disabled', () => {
    writeTokenList([{ name: 'overage', token: 'fake-overage' }]);
    writeCacheWithHeaders('fake-overage', {
      'anthropic-ratelimit-unified-status': 'allowed',
      'anthropic-ratelimit-unified-overage-disabled-reason': 'org_disabled',
      'anthropic-ratelimit-unified-5h-status': 'allowed',
      'anthropic-ratelimit-unified-5h-reset': String(NOW + HOUR),
      'anthropic-ratelimit-unified-5h-utilization': '0.1',
      'anthropic-ratelimit-unified-7d-status': 'allowed',
      'anthropic-ratelimit-unified-7d-reset': String(NOW + DAY),
      'anthropic-ratelimit-unified-7d-utilization': '0.1',
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('overage');
    expect(output.selectedToken).toBe('fake-overage');
  });

  it('returns null when every token is unusable (subscription-disabled or rejected)', () => {
    writeTokenList([
      { name: 'disabled', token: 'fake-disabled' },
      { name: 'rejected', token: 'fake-rejected' },
    ]);
    writeSubscriptionDisabledCache('fake-disabled');
    writeCacheWithHeaders('fake-rejected', {
      'anthropic-ratelimit-unified-status': 'rejected',
      'anthropic-ratelimit-unified-5h-status': 'allowed',
      'anthropic-ratelimit-unified-5h-reset': String(NOW + HOUR),
      'anthropic-ratelimit-unified-5h-utilization': '0.1',
      'anthropic-ratelimit-unified-7d-status': 'allowed',
      'anthropic-ratelimit-unified-7d-reset': String(NOW + DAY),
      'anthropic-ratelimit-unified-7d-utilization': '0.1',
    });

    const handler = new OauthTokenSelectHandler();
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.selectedName).toBeNull();
  });

  describe('resolveTokenListJsonPath', () => {
    it('prefers the explicit path over the environment variable', () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH = '/from/env.json';
      expect(resolveTokenListJsonPath('/explicit.json')).toBe('/explicit.json');
    });

    it('falls back to the environment variable when no explicit path is given', () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH = '/from/env.json';
      expect(resolveTokenListJsonPath(null)).toBe('/from/env.json');
    });

    it('returns null when neither source provides a path', () => {
      expect(resolveTokenListJsonPath(null)).toBeNull();
    });
  });

  describe('resolveCacheDirectory', () => {
    it('prefers the explicit directory over the environment variable', () => {
      process.env.TDPM_RATELIMIT_CACHE_DIR = '/from/env';
      expect(resolveCacheDirectory('/explicit')).toBe('/explicit');
    });

    it('falls back to the environment variable when no explicit directory is given', () => {
      process.env.TDPM_RATELIMIT_CACHE_DIR = '/from/env';
      expect(resolveCacheDirectory(null)).toBe('/from/env');
    });

    it('falls back to the default tdpm cache directory', () => {
      expect(resolveCacheDirectory(null)).toContain(
        path.join('tdpm', 'ratelimit'),
      );
    });
  });
});
