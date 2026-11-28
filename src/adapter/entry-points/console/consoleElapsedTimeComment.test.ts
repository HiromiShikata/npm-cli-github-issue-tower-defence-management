import {
  CONSOLE_ELAPSED_TIME_MARKER,
  appendConsoleElapsedTimeLine,
  formatConsoleElapsedTimeLine,
  isConsoleElapsedTimeCommentBody,
  shouldRecordConsoleElapsedTime,
  stripConsoleElapsedTimeLine,
} from './consoleElapsedTimeComment';

describe('console elapsed time comment helpers', () => {
  test.each([
    [0, '0分0秒'],
    [59_999, '0分59秒'],
    [60_000, '1分0秒'],
    [3_599_999, '59分59秒'],
  ])('formats boundary elapsed time %i as %s', (elapsedMs, duration) => {
    expect(
      formatConsoleElapsedTimeLine(elapsedMs, '「操作」を押しました'),
    ).toBe(`コンソールで開いてから ${duration} で「操作」を押しました${CONSOLE_ELAPSED_TIME_MARKER}`);
  });

  test('appends a formatted line after the original comment body', () => {
    const line = formatConsoleElapsedTimeLine(192_000, '「+1日」を押しました（Next Action Date を 2026-11-29 に設定）');
    expect(appendConsoleElapsedTimeLine('既存のコメント', line)).toBe(
      `既存のコメント\n\n${line}`,
    );
  });

  test.each([
    ['plain body', '本文', false],
    ['marked body', `本文${CONSOLE_ELAPSED_TIME_MARKER}`, true],
  ])('detects elapsed marker in %s', (_name, body, expected) => {
    expect(isConsoleElapsedTimeCommentBody(body)).toBe(expected);
  });

  test.each([
    ['body with suffix', `本文\n\n経過行${CONSOLE_ELAPSED_TIME_MARKER}`, '本文'],
    ['elapsed-only body', `経過行${CONSOLE_ELAPSED_TIME_MARKER}`, ''],
    ['different final suffix', `本文\n経過行${CONSOLE_ELAPSED_TIME_MARKER}`, `本文\n経過行${CONSOLE_ELAPSED_TIME_MARKER}`],
    ['marker in earlier text', `経過行${CONSOLE_ELAPSED_TIME_MARKER}\n\n本文`, `経過行${CONSOLE_ELAPSED_TIME_MARKER}\n\n本文`],
  ])('strips only a terminal elapsed line for %s', (_name, body, expected) => {
    expect(stripConsoleElapsedTimeLine(body)).toBe(expected);
  });

  test.each([
    ['https://github.com/HiromiShikata/repo/issues/1', true],
    ['https://github.com/HiromiShikata/repo/pull/2', true],
    ['https://github.com/other-owner/repo/issues/1', false],
    ['https://github.com/HiromiShikata/repo/commit/abc', false],
    ['not a github url', false],
  ])('allows elapsed recording only for owner repository item URL %s', (url, expected) => {
    expect(shouldRecordConsoleElapsedTime(url)).toBe(expected);
  });
});
