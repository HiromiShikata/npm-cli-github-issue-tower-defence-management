import {
  buildConsoleTimerHeaderView,
  formatConsoleTimerRemaining,
} from './consoleTimerHeader';

describe('formatConsoleTimerRemaining', () => {
  it.each([
    [0, '00:00'],
    [5, '00:05'],
    [60, '01:00'],
    [754, '12:34'],
    [6000, '100:00'],
  ])('formats %s remaining seconds as %s', (remainingSeconds, expected) => {
    expect(formatConsoleTimerRemaining(remainingSeconds)).toBe(expected);
  });
});

describe('buildConsoleTimerHeaderView', () => {
  const baseInput = {
    pjcode: 'alpha',
    pjcodes: ['alpha', 'beta', 'gamma'],
    projectMinutes: { alpha: 5, beta: 5, gamma: 5 },
    projectTodoByHumanCounts: { beta: 1 },
    projectAwaitingOwnerCounts: {},
    timerStartedAtMs: 1_000_000,
    nowMs: 1_000_000,
  };

  it.each([
    {
      name: 'normal with whole minutes and seconds remaining',
      nowMs: 1_000_000 + 179_999,
      expected: { tone: 'normal', timeText: '02:01', nextText: 'beta' },
    },
    {
      name: 'normal at exactly one minute remaining',
      nowMs: 1_000_000 + 240_000,
      expected: { tone: 'normal', timeText: '01:00', nextText: 'beta' },
    },
    {
      name: 'warning below one minute remaining',
      nowMs: 1_000_000 + 240_001,
      expected: { tone: 'warning', timeText: '01:00', nextText: 'beta' },
    },
    {
      name: 'warning with one millisecond remaining',
      nowMs: 1_000_000 + 299_999,
      expected: { tone: 'warning', timeText: '00:01', nextText: 'beta' },
    },
    {
      name: 'danger at expiry',
      nowMs: 1_000_000 + 300_000,
      expected: { tone: 'danger', timeText: 'next submit', nextText: 'beta' },
    },
    {
      name: 'danger after expiry',
      nowMs: 1_000_000 + 300_001,
      expected: { tone: 'danger', timeText: 'next submit', nextText: 'beta' },
    },
    {
      name: 'muted while time remains without a next project',
      nowMs: 1_000_000 + 299_999,
      expected: { tone: 'muted', timeText: '00:01', nextText: 'none' },
      projectTodoByHumanCounts: {},
    },
    {
      name: 'muted after expiry without a next project',
      nowMs: 1_000_000 + 300_001,
      expected: { tone: 'muted', timeText: '00:00', nextText: 'none' },
      projectTodoByHumanCounts: {},
    },
  ])('builds the $name view', ({ nowMs, expected, ...overrides }) => {
    expect(
      buildConsoleTimerHeaderView({
        ...baseInput,
        nowMs,
        ...overrides,
      }),
    ).toEqual(expected);
  });

  it.each([
    {
      name: 'wraps around after the last project',
      input: {
        pjcode: 'gamma',
        projectTodoByHumanCounts: { alpha: 1 },
      },
      expected: 'alpha',
    },
    {
      name: 'skips projects with zero minutes',
      input: {
        projectMinutes: { alpha: 5, beta: 0, gamma: 5 },
        projectTodoByHumanCounts: { gamma: 1 },
      },
      expected: 'gamma',
    },
    {
      name: 'skips projects with no todo or awaiting-owner items',
      input: {
        projectTodoByHumanCounts: { gamma: 1 },
        projectAwaitingOwnerCounts: { beta: 0 },
      },
      expected: 'gamma',
    },
    {
      name: 'uses awaiting-owner items as a qualifying count',
      input: {
        projectTodoByHumanCounts: {},
        projectAwaitingOwnerCounts: { beta: 1 },
      },
      expected: 'beta',
    },
    {
      name: 'uses default minutes for a missing project entry',
      input: {
        projectMinutes: { alpha: 5 },
        projectTodoByHumanCounts: { beta: 1 },
      },
      expected: 'beta',
    },
    {
      name: 'excludes the current project',
      input: {
        projectTodoByHumanCounts: { alpha: 1 },
        projectAwaitingOwnerCounts: { alpha: 1 },
      },
      expected: null,
    },
  ])('selects the next project when it $name', ({ input, expected }) => {
    expect(
      buildConsoleTimerHeaderView({
        ...baseInput,
        ...input,
        nowMs: 1_000_000,
      })?.nextText ?? null,
    ).toBe(expected);
  });

  it.each([
    {
      name: 'has no current project',
      input: { pjcode: null },
    },
    {
      name: 'has a current project with zero minutes',
      input: { projectMinutes: { alpha: 0 } },
    },
    {
      name: 'has a current project with negative minutes',
      input: { projectMinutes: { alpha: -1 } },
    },
  ])('returns null when the current timer $name', ({ input }) => {
    expect(
      buildConsoleTimerHeaderView({
        ...baseInput,
        ...input,
      }),
    ).toBeNull();
  });
});
