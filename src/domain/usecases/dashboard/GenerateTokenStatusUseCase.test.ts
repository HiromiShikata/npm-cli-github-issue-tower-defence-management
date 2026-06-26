import {
  GenerateTokenStatusUseCase,
  TokenRateLimitDecision,
  TokenRateLimitSnapshot,
  judgeTokenColor,
} from './GenerateTokenStatusUseCase';

const usableDecision = (
  overrides: Partial<TokenRateLimitDecision> = {},
): TokenRateLimitDecision => ({
  fiveHourUtilization: 0.1,
  sevenDayUtilization: 0.1,
  fiveHourRejected: false,
  sevenDayRejected: false,
  blocked: false,
  unifiedStatus: 'allowed',
  sevenDaySonnetRejected: false,
  sevenDayOpusRejected: false,
  partial: false,
  ...overrides,
});

describe('judgeTokenColor', () => {
  it('returns Y when there is no snapshot or the snapshot is partial', () => {
    expect(judgeTokenColor(null)).toBe('Y');
    expect(judgeTokenColor(usableDecision({ partial: true }))).toBe('Y');
  });

  it('returns G for a normal allowed low-utilization token', () => {
    expect(judgeTokenColor(usableDecision())).toBe('G');
  });

  it('returns Y for high utilization while allowed', () => {
    expect(judgeTokenColor(usableDecision({ fiveHourUtilization: 0.8 }))).toBe(
      'Y',
    );
  });

  it('keeps a token usable (G) when only Sonnet 7d is rejected but Opus is usable', () => {
    expect(
      judgeTokenColor(
        usableDecision({
          sevenDaySonnetRejected: true,
          sevenDayOpusRejected: false,
        }),
      ),
    ).toBe('G');
  });

  it('returns Y when Sonnet is rejected, Opus usable, and 7d utilization is high', () => {
    expect(
      judgeTokenColor(
        usableDecision({
          sevenDaySonnetRejected: true,
          sevenDayOpusRejected: false,
          sevenDayUtilization: 0.8,
        }),
      ),
    ).toBe('Y');
  });

  it('returns K when both Sonnet and Opus 7d are rejected', () => {
    expect(
      judgeTokenColor(
        usableDecision({
          sevenDaySonnetRejected: true,
          sevenDayOpusRejected: true,
        }),
      ),
    ).toBe('K');
  });

  it('returns K when the general 7d window is rejected', () => {
    expect(judgeTokenColor(usableDecision({ sevenDayRejected: true }))).toBe(
      'K',
    );
  });

  it('returns K when the 5h window is rejected', () => {
    expect(judgeTokenColor(usableDecision({ fiveHourRejected: true }))).toBe(
      'K',
    );
  });

  it('returns K when 5h utilization is exhausted', () => {
    expect(judgeTokenColor(usableDecision({ fiveHourUtilization: 1.0 }))).toBe(
      'K',
    );
  });

  it('returns Y for the allowed_warning unified status', () => {
    expect(
      judgeTokenColor(usableDecision({ unifiedStatus: 'allowed_warning' })),
    ).toBe('Y');
  });
});

const snapshot = (
  overrides: Partial<TokenRateLimitSnapshot> = {},
): TokenRateLimitSnapshot => ({
  fiveHourUtilization: 0.1,
  fiveHourReset: 0,
  sevenDayUtilization: 0.1,
  sevenDayReset: 0,
  blocked: false,
  fiveHourRejected: false,
  sevenDayRejected: false,
  unifiedStatus: 'allowed',
  sevenDaySonnetRejected: false,
  sevenDayOpusRejected: false,
  hasWindowData: true,
  ...overrides,
});

describe('GenerateTokenStatusUseCase', () => {
  const usecase = new GenerateTokenStatusUseCase();
  const now = 1_000_000;

  it('renders per-token utilization percents, color, prep and hum counts', () => {
    const result = usecase.run({
      tokens: [
        {
          name: 'alice',
          token: 'token-a',
          snapshot: snapshot({
            fiveHourUtilization: 0.42,
            fiveHourReset: now + 3600,
            sevenDayUtilization: 0.8,
            sevenDayReset: now + 86400,
          }),
        },
        { name: 'bob', token: 'token-b', snapshot: null },
      ],
      prepCountByToken: new Map([['token-a', 2]]),
      humCountByToken: new Map([['token-a', 1]]),
      nowEpochSeconds: now,
    });

    expect(result).toEqual([
      {
        name: 'alice',
        fiveHourUtilizationPercent: 42,
        fiveHourResetSeconds: 3600,
        sevenDayUtilizationPercent: 80,
        sevenDayResetSeconds: 86400,
        color: 'Y',
        prep: 2,
        hum: 1,
      },
      {
        name: 'bob',
        fiveHourUtilizationPercent: null,
        fiveHourResetSeconds: null,
        sevenDayUtilizationPercent: null,
        sevenDayResetSeconds: null,
        color: 'Y',
        prep: 0,
        hum: 0,
      },
    ]);
  });

  it('reports G for an allowed token with headroom on both windows', () => {
    const result = usecase.run({
      tokens: [
        {
          name: 'alice',
          token: 'token-a',
          snapshot: snapshot({
            fiveHourUtilization: 0.1,
            fiveHourReset: now + 3600,
            sevenDayUtilization: 0.1,
            sevenDayReset: now + 86400,
          }),
        },
      ],
      prepCountByToken: new Map(),
      humCountByToken: new Map(),
      nowEpochSeconds: now,
    });

    expect(result[0].color).toBe('G');
  });

  it('zeroes a window whose reset is already in the past and clears its rejection', () => {
    const result = usecase.run({
      tokens: [
        {
          name: 'alice',
          token: 'token-a',
          snapshot: snapshot({
            fiveHourUtilization: 1.0,
            fiveHourReset: now - 10,
            fiveHourRejected: true,
            sevenDayUtilization: 0.2,
            sevenDayReset: now + 86400,
          }),
        },
      ],
      prepCountByToken: new Map(),
      humCountByToken: new Map(),
      nowEpochSeconds: now,
    });

    expect(result[0].fiveHourUtilizationPercent).toBe(0);
    expect(result[0].fiveHourResetSeconds).toBe(0);
    expect(result[0].color).toBe('G');
  });
});
