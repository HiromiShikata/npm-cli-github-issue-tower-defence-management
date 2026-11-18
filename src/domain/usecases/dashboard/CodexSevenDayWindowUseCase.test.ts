import {
  CODEX_SEVEN_DAY_WINDOW_MINUTES,
  findLatestCodexSevenDayRateLimit,
  isCodexSevenDayWindowReset,
  parseCodexRateLimitLine,
} from './CodexSevenDayWindowUseCase';

const TIMESTAMP = '2026-11-18T02:16:17.179Z';

const window = (
  windowMinutes: number,
  usedPercent: number,
  resetsAt: number,
): Record<string, number> => ({
  used_percent: usedPercent,
  window_minutes: windowMinutes,
  resets_at: resetsAt,
});

const tokenCountLine = (
  timestamp: string,
  rateLimits: Record<string, unknown> | null,
): string =>
  JSON.stringify({
    timestamp,
    ordinal: 163,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: null,
      rate_limits: rateLimits,
    },
  });

const rateLimits = (
  primary: Record<string, number> | null,
  secondary: Record<string, number> | null,
): Record<string, unknown> => ({
  limit_id: 'codex',
  limit_name: null,
  primary,
  secondary,
  credits: null,
  plan_type: 'promax',
  rate_limit_reached_type: null,
});

describe('CODEX_SEVEN_DAY_WINDOW_MINUTES', () => {
  it('is the 7-day window length in minutes', () => {
    expect(CODEX_SEVEN_DAY_WINDOW_MINUTES).toBe(10080);
  });
});

describe('parseCodexRateLimitLine', () => {
  const cases: {
    name: string;
    line: string;
    expected: {
      capturedAt: string;
      usedPercent: number;
      resetsAtEpochSeconds: number;
    } | null;
  }[] = [
    {
      name: 'reads the 7-day window when it is the primary window',
      line: tokenCountLine(
        TIMESTAMP,
        rateLimits(window(10080, 11, 1795004568), null),
      ),
      expected: {
        capturedAt: TIMESTAMP,
        usedPercent: 11,
        resetsAtEpochSeconds: 1795004568,
      },
    },
    {
      name: 'reads the 7-day window when it is the secondary window',
      line: tokenCountLine(
        TIMESTAMP,
        rateLimits(
          window(300, 40, 1795000000),
          window(10080, 25.5, 1795004999),
        ),
      ),
      expected: {
        capturedAt: TIMESTAMP,
        usedPercent: 25.5,
        resetsAtEpochSeconds: 1795004999,
      },
    },
    {
      name: 'returns null when no window is the 7-day window',
      line: tokenCountLine(
        TIMESTAMP,
        rateLimits(window(300, 40, 1795000000), null),
      ),
      expected: null,
    },
    {
      name: 'returns null when rate_limits is null',
      line: tokenCountLine(TIMESTAMP, null),
      expected: null,
    },
    {
      name: 'returns null for a line without rate_limits',
      line: JSON.stringify({
        timestamp: TIMESTAMP,
        type: 'event_msg',
        payload: { type: 'task_complete' },
      }),
      expected: null,
    },
    {
      name: 'returns null when the 7-day window has no numeric used_percent',
      line: tokenCountLine(TIMESTAMP, {
        primary: { window_minutes: 10080, resets_at: 1795004568 },
        secondary: null,
      }),
      expected: null,
    },
  ];

  it.each(cases)('$name', ({ line, expected }) => {
    expect(parseCodexRateLimitLine(line)).toEqual(expected);
  });

  it('throws when a line carrying rate_limits is not valid JSON', () => {
    expect(() =>
      parseCodexRateLimitLine('{"payload":{"rate_limits":{"primary":'),
    ).toThrow();
  });
});

describe('findLatestCodexSevenDayRateLimit', () => {
  it('returns the last 7-day observation scanning from the end', () => {
    const lines = [
      tokenCountLine(
        '2026-11-18T01:00:00.000Z',
        rateLimits(window(10080, 10, 1795004568), null),
      ),
      tokenCountLine(
        '2026-11-18T02:00:00.000Z',
        rateLimits(window(10080, 12, 1795004568), null),
      ),
      JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } }),
    ];
    expect(findLatestCodexSevenDayRateLimit(lines)).toEqual({
      capturedAt: '2026-11-18T02:00:00.000Z',
      usedPercent: 12,
      resetsAtEpochSeconds: 1795004568,
    });
  });

  it('skips newer lines that carry only a 5-hour window', () => {
    const lines = [
      tokenCountLine(
        '2026-11-18T01:00:00.000Z',
        rateLimits(window(10080, 10, 1795004568), null),
      ),
      tokenCountLine(
        '2026-11-18T02:00:00.000Z',
        rateLimits(window(300, 40, 1795000000), null),
      ),
    ];
    expect(findLatestCodexSevenDayRateLimit(lines)?.usedPercent).toBe(10);
  });

  it('returns null when no line carries a 7-day window', () => {
    expect(
      findLatestCodexSevenDayRateLimit([
        JSON.stringify({ type: 'event_msg', payload: {} }),
      ]),
    ).toBeNull();
    expect(findLatestCodexSevenDayRateLimit([])).toBeNull();
  });
});

describe('isCodexSevenDayWindowReset', () => {
  const RESETS_AT = 1795004568;
  const cases: { name: string; now: number; expected: boolean }[] = [
    { name: 'is false one second before resets_at', now: RESETS_AT - 1, expected: false },
    { name: 'is true exactly at resets_at', now: RESETS_AT, expected: true },
    { name: 'is true after resets_at', now: RESETS_AT + 3600, expected: true },
  ];

  it.each(cases)('$name', ({ now, expected }) => {
    expect(isCodexSevenDayWindowReset(RESETS_AT, now)).toBe(expected);
  });
});
