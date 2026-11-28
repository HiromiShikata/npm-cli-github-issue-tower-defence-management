import {
  type ConsoleActionTiming,
  clearConsoleItemOpenTimesForTest,
  computeOpenedToActionMs,
  readConsoleItemOpenedAt,
  recordConsoleItemOpened,
  withConsoleActionTiming,
} from './consoleItemOpenTimes';

describe('withConsoleActionTiming', () => {
  const cases: ReadonlyArray<
    [
      string,
      ConsoleActionTiming,
      { requestBody: Record<string, unknown>; extra: string },
      { requestBody: Record<string, unknown>; extra: string },
    ]
  > = [
    [
      'includes elapsed timing',
      { openedToActionMs: 1250, actionDescription: 'pressed approve' },
      { requestBody: { action: 'approve', keep: true }, extra: 'value' },
      {
        requestBody: {
          action: 'approve',
          keep: true,
          openedToActionMs: 1250,
          actionDescription: 'pressed approve',
        },
        extra: 'value',
      },
    ],
    [
      'does not add undefined elapsed timing',
      { actionDescription: 'pressed approve' },
      { requestBody: { action: 'approve' }, extra: 'value' },
      { requestBody: { action: 'approve' }, extra: 'value' },
    ],
  ];

  test.each(cases)('%s', (_name, timing, payload, expected) => {
    const original = JSON.parse(JSON.stringify(payload));
    const result = withConsoleActionTiming(payload, timing);

    expect(result).toEqual(expected);
    expect(payload).toEqual(original);
    if (timing.openedToActionMs === undefined) {
      expect(result).toBe(payload);
    } else {
      expect(result).not.toBe(payload);
      expect(result.requestBody).not.toBe(payload.requestBody);
    }
  });
});

describe('computeOpenedToActionMs', () => {
  test.each([
    ['missing open time', undefined, 10_000, undefined],
    ['positive elapsed time', 1_000, 3_001, 2_001],
    ['fractional elapsed time is floored', 1_000.5, 3_001.9, 2_001],
    ['negative elapsed time', 3_001, 3_000, undefined],
    ['non-finite opened time', Number.NaN, 3_000, undefined],
    ['non-finite pressed time', 1_000, Number.POSITIVE_INFINITY, undefined],
  ])(
    'returns the expected result for %s',
    (_name, openedAtMs, pressedAtMs, expected) => {
      expect(computeOpenedToActionMs(openedAtMs, pressedAtMs)).toBe(expected);
    },
  );
});

describe('console item open time memory', () => {
  beforeEach(() => clearConsoleItemOpenTimesForTest());

  test.each([
    ['issue URL', 'https://github.com/HiromiShikata/repo/issues/1', 100],
    ['pull request URL', 'https://github.com/HiromiShikata/repo/pull/2', 200],
  ])(
    'records and reads the most recent opening for %s',
    (_name, itemUrl, openedAtMs) => {
      recordConsoleItemOpened(itemUrl, openedAtMs);
      expect(readConsoleItemOpenedAt(itemUrl)).toBe(openedAtMs);
      recordConsoleItemOpened(itemUrl, openedAtMs + 50);
      expect(readConsoleItemOpenedAt(itemUrl)).toBe(openedAtMs + 50);
    },
  );

  test('returns undefined after the test reset', () => {
    recordConsoleItemOpened(
      'https://github.com/HiromiShikata/repo/issues/1',
      100,
    );
    clearConsoleItemOpenTimesForTest();
    expect(
      readConsoleItemOpenedAt('https://github.com/HiromiShikata/repo/issues/1'),
    ).toBeUndefined();
  });
});
