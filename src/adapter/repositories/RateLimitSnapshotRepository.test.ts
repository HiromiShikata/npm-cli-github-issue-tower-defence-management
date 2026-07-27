const mockReadRateLimit = jest.fn();
const mockLoadTokenEntries = jest.fn();

jest.mock('../proxy/RateLimitCache', () => ({
  cacheDir: () => '/mock/cache',
  readRateLimit: mockReadRateLimit,
}));

jest.mock('../proxy/TokenListLoader', () => ({
  loadTokenEntries: mockLoadTokenEntries,
}));

import { RateLimitSnapshotRepository } from './RateLimitSnapshotRepository';

const nowEpoch = Math.floor(Date.now() / 1000);

const fullCacheSnapshot = (
  overrides: Partial<ReturnType<typeof mockReadRateLimit>> = {},
) => ({
  fiveHourUtilization: 0.5,
  fiveHourReset: nowEpoch + 3600,
  sevenDayUtilization: 0.2,
  sevenDayReset: nowEpoch + 86400,
  blocked: false,
  rejected: false,
  blockedUntilEpoch: 0,
  modelWeeklyLimits: {},
  lastUpdatedEpoch: nowEpoch - 30,
  ...overrides,
});

describe('RateLimitSnapshotRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when token list file cannot be loaded', () => {
    mockLoadTokenEntries.mockReturnValue(null);
    const repository = new RateLimitSnapshotRepository('/tokens.json');

    expect(repository.listSnapshots()).toEqual([]);
  });

  it('skips tokens for which the rate-limit cache has no entry', () => {
    mockLoadTokenEntries.mockReturnValue([
      { name: 'token-a', token: 'tok-aaa' },
    ]);
    mockReadRateLimit.mockReturnValue(null);
    const repository = new RateLimitSnapshotRepository('/tokens.json');

    expect(repository.listSnapshots()).toEqual([]);
  });

  it('maps cache snapshot fields to domain TokenRateLimitSnapshot', () => {
    const cacheEntry = fullCacheSnapshot({
      fiveHourUtilization: 0.75,
      sevenDayUtilization: 0.1,
      blocked: true,
      rejected: false,
      blockedUntilEpoch: nowEpoch + 60,
      lastUpdatedEpoch: nowEpoch - 120,
    });
    mockLoadTokenEntries.mockReturnValue([
      { name: 'my-token', token: 'tok-xyz' },
    ]);
    mockReadRateLimit.mockReturnValue(cacheEntry);
    const repository = new RateLimitSnapshotRepository('/tokens.json');

    const [snapshot] = repository.listSnapshots();

    expect(snapshot).toMatchObject({
      token: 'tok-xyz',
      name: 'my-token',
      fiveHourUtilization: 0.75,
      fiveHourReset: cacheEntry.fiveHourReset,
      sevenDayUtilization: 0.1,
      sevenDayReset: cacheEntry.sevenDayReset,
      blocked: true,
      rejected: false,
      blockedUntilEpoch: nowEpoch + 60,
      lastUpdatedEpoch: nowEpoch - 120,
      modelWeeklyLimits: [],
    });
  });

  it('maps modelWeeklyLimits from cache record to domain array', () => {
    const cacheEntry = fullCacheSnapshot({
      modelWeeklyLimits: {
        claude_opus_4: { rejected: true, resetsAt: nowEpoch + 7200 },
        claude_sonnet_5: { rejected: false, resetsAt: 0 },
      },
    });
    mockLoadTokenEntries.mockReturnValue([
      { name: 'token-a', token: 'tok-aaa' },
    ]);
    mockReadRateLimit.mockReturnValue(cacheEntry);
    const repository = new RateLimitSnapshotRepository('/tokens.json');

    const [snapshot] = repository.listSnapshots();

    expect(snapshot.modelWeeklyLimits).toEqual(
      expect.arrayContaining([
        { rejected: true, resetsAt: nowEpoch + 7200 },
        { rejected: false, resetsAt: 0 },
      ]),
    );
    expect(snapshot.modelWeeklyLimits).toHaveLength(2);
  });

  it('returns one snapshot per token that has a cache entry', () => {
    mockLoadTokenEntries.mockReturnValue([
      { name: 'token-a', token: 'tok-aaa' },
      { name: 'token-b', token: 'tok-bbb' },
      { name: 'token-c', token: 'tok-ccc' },
    ]);
    mockReadRateLimit.mockImplementation((token: string) => {
      if (token === 'tok-bbb') return null;
      return fullCacheSnapshot();
    });
    const repository = new RateLimitSnapshotRepository('/tokens.json');

    const snapshots = repository.listSnapshots();

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((s) => s.token)).toEqual(['tok-aaa', 'tok-ccc']);
  });

  it('passes the custom baseDir to readRateLimit', () => {
    mockLoadTokenEntries.mockReturnValue([
      { name: 'token-a', token: 'tok-aaa' },
    ]);
    mockReadRateLimit.mockReturnValue(fullCacheSnapshot());
    const repository = new RateLimitSnapshotRepository(
      '/tokens.json',
      '/custom/cache/dir',
    );

    repository.listSnapshots();

    expect(mockReadRateLimit).toHaveBeenCalledWith('tok-aaa', '/custom/cache/dir');
  });
});
