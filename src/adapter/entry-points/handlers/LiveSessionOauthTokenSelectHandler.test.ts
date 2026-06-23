import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ClaudeLiveSession,
  ClaudeLiveSessionRepository,
} from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import { LiveSessionOauthTokenSelectUseCase } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import { hashToken } from '../../proxy/RateLimitCache';
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

  const buildHandler = (
    sessions: ClaudeLiveSession[],
  ): LiveSessionOauthTokenSelectHandler =>
    new LiveSessionOauthTokenSelectHandler(
      new LiveSessionOauthTokenSelectUseCase(),
      new FakeClaudeLiveSessionRepository(sessions),
    );

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
      { token: 'fake-busy', sessionId: 'session-a' },
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
      { token: 'fake-far', sessionId: 'session-a' },
      { token: 'fake-soon', sessionId: 'session-b' },
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
      { token: 'fake-one', sessionId: 'session-a' },
      { token: 'fake-one', sessionId: 'session-a' },
      { token: 'fake-two', sessionId: 'session-b' },
      { token: 'fake-two', sessionId: 'session-c' },
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
      { token: 'fake-free', sessionId: 'session-a' },
    ]);
    const output = handler.handle({
      tokenListJsonPath: tokenListPath,
      cacheDirectory,
      nowEpochSeconds: NOW,
    });

    expect(output.selectedName).toBe('free');
  });

  it('returns null and a diagnostic when no token passes the filter', () => {
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
    expect(output.diagnostics.join('\n')).toContain(
      'No eligible token passed the rate-limit filter.',
    );
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
});
