import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ClaudeLiveSession,
  ClaudeLiveSessionRepository,
} from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import { LiveSessionOauthTokenSelectUseCase } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import { FABLE_LIMIT_TYPE, hashToken } from '../../proxy/RateLimitCache';
import { LiveSessionOauthTokenSelectHandler } from './LiveSessionOauthTokenSelectHandler';

const NOW = 2_000_000;
const HOUR = 3600;
const DAY = 86400;

type FakeHeaders = {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
};

class FakeClaudeLiveSessionRepository implements ClaudeLiveSessionRepository {
  constructor(private readonly sessions: ClaudeLiveSession[]) {}

  listLiveSessions = (): ClaudeLiveSession[] => this.sessions;
}

describe('LiveSessionOauthTokenSelectHandler', () => {
  let tempDir: string;
  let cacheDirectory: string;
  let tokenListPath: string;
  const originalTokenListEnv =
    process.env.CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH;
  const originalCacheEnv = process.env.TDPM_RATELIMIT_CACHE_DIR;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'select-live-token-'));
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

  const buildHandler = (
    sessions: ClaudeLiveSession[],
  ): LiveSessionOauthTokenSelectHandler =>
    new LiveSessionOauthTokenSelectHandler(
      new LiveSessionOauthTokenSelectUseCase(),
      new FakeClaudeLiveSessionRepository(sessions),
    );

  const writeFableRejectionCache = (token: string, resetsAt: number): void => {
    const payload = {
      ts: NOW,
      headers: {
        'anthropic-ratelimit-unified-status': 'allowed',
        'anthropic-ratelimit-unified-5h-status': 'allowed',
        'anthropic-ratelimit-unified-5h-reset': String(NOW + HOUR),
        'anthropic-ratelimit-unified-5h-utilization': '0.1',
        'anthropic-ratelimit-unified-7d-status': 'allowed',
        'anthropic-ratelimit-unified-7d-reset': String(NOW + DAY),
        'anthropic-ratelimit-unified-7d-utilization': '0.1',
      },
      modelWeeklyLimits: {
        [FABLE_LIMIT_TYPE]: { rejected: true, resetsAt },
      },
    };
    fs.writeFileSync(
      path.join(cacheDirectory, `${hashToken(token)}.json`),
      JSON.stringify(payload),
    );
  };

  it('excludes a token whose fable marker is set even when it is unoccupied', () => {
    writeTokenList([
      { name: 'fable-out', token: 'fake-fable-out' },
      { name: 'active', token: 'fake-active' },
    ]);
    writeFableRejectionCache('fake-fable-out', NOW + HOUR);
    writeCache('fake-active', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = buildHandler([]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('active');
    expect(output.diagnostics.join('\n')).toContain(
      'fable weekly limit exhausted',
    );
  });

  it('selects the eligible token with the fewest live sessions', () => {
    writeTokenList([
      { name: 'busy', token: 'fake-busy' },
      { name: 'idle', token: 'fake-idle' },
    ]);
    writeCache('fake-busy', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 2 * DAY,
    });
    writeCache('fake-idle', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 6 * DAY,
    });

    const handler = buildHandler([
      { token: 'fake-busy', sessionKey: 'session-a' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('idle');
    expect(output.selectedToken).toBe('fake-idle');
  });

  it('breaks an occupancy tie by the soonest 7d reset', () => {
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

    const handler = buildHandler([
      { token: 'fake-far', sessionKey: 'session-a' },
      { token: 'fake-soon', sessionKey: 'session-b' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('soon');
  });

  it('dedupes child processes that share a session id when counting occupancy', () => {
    writeTokenList([
      { name: 'oneSession', token: 'fake-one' },
      { name: 'twoSessions', token: 'fake-two' },
    ]);
    writeCache('fake-one', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 2 * DAY,
    });
    writeCache('fake-two', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + 6 * DAY,
    });

    const handler = buildHandler([
      { token: 'fake-one', sessionKey: 'session-a' },
      { token: 'fake-one', sessionKey: 'session-a' },
      { token: 'fake-two', sessionKey: 'session-b' },
      { token: 'fake-two', sessionKey: 'session-c' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('oneSession');
  });

  it('excludes a rate-limit-ineligible token even when it is unoccupied', () => {
    writeTokenList([
      { name: 'blocked', token: 'fake-blocked' },
      { name: 'free', token: 'fake-free' },
    ]);
    writeCache('fake-blocked', {
      fiveHourUtilization: 0.9,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });
    writeCache('fake-free', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = buildHandler([
      { token: 'fake-free', sessionKey: 'session-a' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('free');
  });

  it('returns no token and a threshold-naming diagnostic without leaking the token when no token passes the filter', () => {
    writeTokenList([{ name: 'busy', token: 'fake-busy' }]);
    writeCache('fake-busy', {
      fiveHourUtilization: 0.9,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = buildHandler([]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.selectedName).toBeNull();
    const diagnostics = output.diagnostics.join('\n');
    expect(diagnostics).toContain('No eligible token');
    expect(diagnostics).toContain('5h >= 60% free');
    expect(diagnostics).toContain('7d >= 7% free');
    expect(diagnostics).not.toContain('fake-busy');
  });

  it('returns the token on the selected path when an eligible token exists', () => {
    writeTokenList([{ name: 'free', token: 'fake-free' }]);
    writeCache('fake-free', {
      fiveHourUtilization: 0.1,
      fiveHourReset: NOW + HOUR,
      sevenDayUtilization: 0.1,
      sevenDayReset: NOW + DAY,
    });

    const handler = buildHandler([]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBe('fake-free');
    expect(output.selectedName).toBe('free');
    expect(output.diagnostics.join('\n')).not.toContain('No eligible token');
  });

  it('returns a diagnostic when no token list path is resolvable', () => {
    const handler = buildHandler([]);
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

    const handler = buildHandler([]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.diagnostics.join('\n')).toContain('No usable token entries');
  });

  it('excludes a subscription-disabled token even when it has zero live sessions', () => {
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

    const handler = buildHandler([
      { token: 'fake-active', sessionKey: 'session-a' },
    ]);
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

  it('excludes a unified-rejected token even when it has zero live sessions', () => {
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

    const handler = buildHandler([
      { token: 'fake-active', sessionKey: 'session-a' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('active');
    expect(output.diagnostics.join('\n')).toContain('rejected');
  });

  it('returns null and a no-eligible-token diagnostic when every token is unusable', () => {
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

    const handler = buildHandler([]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedToken).toBeNull();
    expect(output.selectedName).toBeNull();
    expect(output.diagnostics.join('\n')).toContain('No eligible token');
  });
});
