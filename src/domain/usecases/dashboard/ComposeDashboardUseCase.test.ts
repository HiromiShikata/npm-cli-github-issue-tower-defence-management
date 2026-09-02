import {
  ComposeDashboardInput,
  ComposeDashboardUseCase,
  PROJECT_ROW_WIDTH_BUDGET,
  SEVEN_DAY_UTILIZATION_COLUMN_START,
  STATUS_DOT_DISPLAY_WIDTH,
  TOKEN_SESSION_COLUMN_START,
  TOKEN_UTILIZATION_WIDTH,
  formatMachineStatusLines,
  formatProjectHeaderLine,
  formatProjectRowLine,
  formatResetCountdown,
  formatSevenDayWindowAggregateLine,
  formatTokenRowLine,
  formatTokenSessionTotalLine,
  roundHalfToEven,
} from './ComposeDashboardUseCase';
import { DashboardRow } from './GenerateDashboardRowUseCase';
import { TokenStatus, TokenStatusColor } from './GenerateTokenStatusUseCase';

const codePointLength = (value: string): number => [...value].length;

const projectRow = (overrides: Partial<DashboardRow>): DashboardRow => ({
  todo: 0,
  qc: 0,
  fail: 0,
  pr: 0,
  ws: 0,
  dep: 0,
  blocker: 0,
  humanPendingRed: 0,
  humanPendingYellow: 0,
  humanPendingBlue: 0,
  ...overrides,
});

const tokenStatus = (overrides: Partial<TokenStatus>): TokenStatus => ({
  name: 'token',
  fiveHourUtilizationPercent: 0,
  fiveHourResetSeconds: 0,
  sevenDayUtilizationPercent: 0,
  sevenDayResetSeconds: 0,
  color: 'G',
  prep: 0,
  hum: 0,
  ...overrides,
});

describe('roundHalfToEven', () => {
  it('rounds halves to the nearest even integer like Python round()', () => {
    expect(roundHalfToEven(0.5)).toBe(0);
    expect(roundHalfToEven(1.5)).toBe(2);
    expect(roundHalfToEven(2.5)).toBe(2);
    expect(roundHalfToEven(3.5)).toBe(4);
    expect(roundHalfToEven(16.0)).toBe(16);
    expect(roundHalfToEven(0.49)).toBe(0);
    expect(roundHalfToEven(0.51)).toBe(1);
  });
});

describe('formatResetCountdown', () => {
  it('renders d/h/m with zero-padded hours and minutes', () => {
    expect(formatResetCountdown(0)).toBe('0d00h00');
    expect(formatResetCountdown(3600)).toBe('0d01h00');
    expect(formatResetCountdown(7200)).toBe('0d02h00');
    expect(formatResetCountdown(86400 * 5)).toBe('5d00h00');
    expect(formatResetCountdown(86400 + 3600 + 60)).toBe('1d01h01');
  });

  it('renders zero for a negative remaining countdown', () => {
    expect(formatResetCountdown(-10)).toBe('0d00h00');
  });
});

describe('formatMachineStatusLines', () => {
  it('renders the host metrics as two lines from a machine status', () => {
    expect(
      formatMachineStatusLines({
        memPct: 55,
        cpuPct: 62,
        diskPct: 93,
        load: [16, 23, 40],
        cycleMinutes: 13,
      }),
    ).toEqual(['M55% C62% 🔴D93% cy13', '🔴LA 16 23 40']);
  });

  it('rounds loads with half-to-even and renders integers', () => {
    expect(
      formatMachineStatusLines({
        memPct: 62,
        cpuPct: 31,
        diskPct: 7,
        load: [1.2, 0.98, 0.75],
        cycleMinutes: 14,
      }),
    ).toEqual(['M62% C31% D7% cy14', 'LA 1 1 1']);
  });

  it('falls back to placeholders when the machine status is absent', () => {
    expect(formatMachineStatusLines(null)).toEqual([
      'M?% C?% D?% cy-',
      'LA ? ? ?',
    ]);
  });

  it('renders cy- when cycle minutes is null', () => {
    expect(
      formatMachineStatusLines({
        memPct: 1,
        cpuPct: 2,
        diskPct: 3,
        load: [0, 0, 0],
        cycleMinutes: null,
      }),
    ).toEqual(['M1% C2% D3% cy-', 'LA 0 0 0']);
  });

  it('renders D?% when only the disk percent is unavailable', () => {
    expect(
      formatMachineStatusLines({
        memPct: 55,
        cpuPct: 62,
        diskPct: null,
        load: [16, 23, 40],
        cycleMinutes: 13,
      }),
    ).toEqual(['M55% C62% D?% cy13', '🔴LA 16 23 40']);
  });

  it('renders each configured partition as title and percent on a disk line', () => {
    expect(
      formatMachineStatusLines({
        memPct: 55,
        cpuPct: 62,
        diskPct: 89,
        disks: [
          { title: 'D', pct: 89 },
          { title: 'S', pct: 41 },
        ],
        load: [16, 23, 40],
        cycleMinutes: 13,
      }),
    ).toEqual(['M55% C62% cy13', '🟡D89% S41%', '🔴LA 16 23 40']);
  });

  it('wraps partitions onto a second disk line when they exceed the width budget', () => {
    const lines = formatMachineStatusLines({
      memPct: 55,
      cpuPct: 62,
      diskPct: 89,
      disks: [
        { title: 'D', pct: 100 },
        { title: 'S', pct: 100 },
        { title: 'A', pct: 100 },
        { title: 'B', pct: 100 },
        { title: 'C', pct: 100 },
        { title: 'E', pct: 100 },
        { title: 'F', pct: 100 },
      ],
      load: [16, 23, 40],
      cycleMinutes: 13,
    });
    expect(lines[0]).toBe('M55% C62% cy13');
    expect(lines[lines.length - 1]).toBe('🔴LA 16 23 40');
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      expect(codePointLength(line)).toBeLessThanOrEqual(
        PROJECT_ROW_WIDTH_BUDGET,
      );
    }
  });

  it('renders the single disk percent when no disks list is present', () => {
    expect(
      formatMachineStatusLines({
        memPct: 55,
        cpuPct: 62,
        diskPct: 89,
        load: [16, 23, 40],
        cycleMinutes: 13,
      }),
    ).toEqual(['M55% C62% 🟡D89% cy13', '🔴LA 16 23 40']);
  });

  it('prefixes memory with yellow dot at 80% and red dot at 90%', () => {
    expect(
      formatMachineStatusLines({
        memPct: 79,
        cpuPct: 0,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toMatch(/^M79%/);
    expect(
      formatMachineStatusLines({
        memPct: 80,
        cpuPct: 0,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toMatch(/^🟡M80%/);
    expect(
      formatMachineStatusLines({
        memPct: 90,
        cpuPct: 0,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toMatch(/^🔴M90%/);
  });

  it('prefixes cpu with yellow dot at 80% and red dot at 90%', () => {
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 79,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('C79%');
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 80,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('🟡C80%');
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 90,
        diskPct: 0,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('🔴C90%');
  });

  it('prefixes disk with yellow dot at 80% and red dot at 90%', () => {
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 0,
        diskPct: 79,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('D79%');
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 0,
        diskPct: 80,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('🟡D80%');
    expect(
      formatMachineStatusLines({
        memPct: 0,
        cpuPct: 0,
        diskPct: 90,
        load: [0, 0, 0],
        cycleMinutes: null,
      })[0],
    ).toContain('🔴D90%');
  });

  it('prefixes load line with yellow dot at 1-min load 5 and red dot at 10', () => {
    const below = formatMachineStatusLines({
      memPct: 0,
      cpuPct: 0,
      diskPct: 0,
      load: [4.9, 0, 0],
      cycleMinutes: null,
    });
    expect(below[below.length - 1]).toMatch(/^LA/);

    const warning = formatMachineStatusLines({
      memPct: 0,
      cpuPct: 0,
      diskPct: 0,
      load: [5, 0, 0],
      cycleMinutes: null,
    });
    expect(warning[warning.length - 1]).toMatch(/^🟡LA/);

    const danger = formatMachineStatusLines({
      memPct: 0,
      cpuPct: 0,
      diskPct: 0,
      load: [10, 0, 0],
      cycleMinutes: null,
    });
    expect(danger[danger.length - 1]).toMatch(/^🔴LA/);
  });

  it('keeps both lines within the 32 character width budget at worst case', () => {
    const lines = formatMachineStatusLines({
      memPct: 100,
      cpuPct: 100,
      diskPct: 100,
      load: [108.5, 120.25, 95.1],
      cycleMinutes: 999,
    });
    expect(lines).toEqual(['🔴M100% 🔴C100% 🔴D100% cy999', '🔴LA 108 120 95']);
    for (const line of lines) {
      expect(codePointLength(line)).toBeLessThanOrEqual(
        PROJECT_ROW_WIDTH_BUDGET,
      );
    }
  });
});

describe('formatProjectHeaderLine', () => {
  it('renders the project grid header with story color signal columns', () => {
    expect(formatProjectHeaderLine()).toBe('pj   td qc fl pp ws dp 🔴 🟡 🔵');
  });

  it('fits within the code point width budget', () => {
    expect(codePointLength(formatProjectHeaderLine())).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
  });
});

describe('formatProjectRowLine', () => {
  it('renders a present row with its severity dot, counts, and story color columns', () => {
    expect(
      formatProjectRowLine({
        code: 'ac',
        row: projectRow({ todo: 1, qc: 2, ws: 4, dep: 1 }),
      }),
    ).toBe('🟢ac  1  2  0  0  4  1  0  0  0');
  });

  it('renders non-zero story color counts in the color columns', () => {
    expect(
      formatProjectRowLine({
        code: 'ac',
        row: projectRow({ humanPendingRed: 8, humanPendingYellow: 3 }),
      }),
    ).toBe('🟢ac  0  0  0  0  0  0  8  3  0');
  });

  it('caps a story color count above 99 at 99', () => {
    expect(
      formatProjectRowLine({
        code: 'ac',
        row: projectRow({ humanPendingRed: 100 }),
      }),
    ).toContain(' 99');
  });

  it('renders placeholder cells with a blank dot for an absent project file', () => {
    expect(formatProjectRowLine({ code: 'in', row: null })).toBe(
      '  in -- -- -- -- -- -- -- -- --',
    );
  });

  it('caps a count above 99 at 99', () => {
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ todo: 1500 }) }),
    ).toBe('🟢ac 99  0  0  0  0  0  0  0  0');
  });

  it('applies the four level severity dot rules in descending order', () => {
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ blocker: 2 }) }),
    ).toContain('🔴');
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ blocker: 1 }) }),
    ).toContain('🟣');
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ qc: 15 }) }),
    ).toContain('🟠');
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ fail: 5 }) }),
    ).toContain('🟠');
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ qc: 10 }) }),
    ).toContain('🟡');
    expect(
      formatProjectRowLine({ code: 'ac', row: projectRow({ fail: 3 }) }),
    ).toContain('🟡');
    expect(
      formatProjectRowLine({
        code: 'ac',
        row: projectRow({ qc: 9, fail: 2 }),
      }),
    ).toContain('🟢');
  });

  it('keeps present and absent rows within the code point width budget', () => {
    const present = formatProjectRowLine({
      code: 'gl',
      row: projectRow({
        todo: 999,
        qc: 999,
        fail: 999,
        pr: 999,
        ws: 999,
        dep: 999,
        humanPendingRed: 99,
        humanPendingYellow: 99,
        humanPendingBlue: 99,
      }),
    });
    const absent = formatProjectRowLine({ code: 'in', row: null });
    expect(codePointLength(present)).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
    expect(codePointLength(absent)).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
  });
});

describe('formatTokenRowLine', () => {
  it('renders a token row with the last two name chars, utilization without percent, reset countdown, prep and hum', () => {
    expect(
      formatTokenRowLine(
        tokenStatus({
          name: 'alice',
          fiveHourUtilizationPercent: 10,
          fiveHourResetSeconds: 3600,
          sevenDayUtilizationPercent: 12,
          sevenDayResetSeconds: 86400 * 5,
          color: 'G',
          prep: 2,
          hum: 1,
        }),
      ),
    ).toBe('🟢ce 10 0d01h00 12 5d00h00 2 1');
  });

  it('uses last two characters of the name and caps utilization at 99', () => {
    expect(
      formatTokenRowLine(
        tokenStatus({
          name: 'bob',
          fiveHourUtilizationPercent: 100,
          fiveHourResetSeconds: 0,
          sevenDayUtilizationPercent: 95,
          sevenDayResetSeconds: 7200,
          color: 'K',
        }),
      ),
    ).toBe('⚪ob 99 0d00h00 95 0d02h00 0 0');
  });

  it('renders question marks when window data is unavailable', () => {
    expect(
      formatTokenRowLine(
        tokenStatus({
          name: 'carolxx',
          fiveHourUtilizationPercent: null,
          fiveHourResetSeconds: null,
          sevenDayUtilizationPercent: null,
          sevenDayResetSeconds: null,
          color: 'Y',
          prep: 1,
          hum: 0,
        }),
      ),
    ).toBe('🟡xx  ? ?  ? ? 1 0');
  });
});

describe('ComposeDashboardUseCase', () => {
  const representativeInput: ComposeDashboardInput = {
    machineStatus: {
      memPct: 55,
      cpuPct: 62,
      diskPct: 89,
      load: [16, 23, 40],
      cycleMinutes: 14,
    },
    projects: [
      {
        code: 'ac',
        row: projectRow({ todo: 1, qc: 2, ws: 4, dep: 1 }),
      },
      {
        code: 'gl',
        row: projectRow({ qc: 16, fail: 6, pr: 1 }),
      },
      { code: 'in', row: null },
      { code: 'um', row: projectRow({ blocker: 1 }) },
    ],
    tokens: [
      tokenStatus({
        name: 'alice',
        fiveHourUtilizationPercent: 10,
        fiveHourResetSeconds: 3600,
        sevenDayUtilizationPercent: 12,
        sevenDayResetSeconds: 86400 * 5,
        color: 'G',
        prep: 2,
        hum: 1,
      }),
      tokenStatus({
        name: 'bob',
        fiveHourUtilizationPercent: 100,
        fiveHourResetSeconds: 0,
        sevenDayUtilizationPercent: 95,
        sevenDayResetSeconds: 7200,
        color: 'K',
        prep: 0,
        hum: 0,
      }),
      tokenStatus({
        name: 'carolxx',
        fiveHourUtilizationPercent: null,
        fiveHourResetSeconds: null,
        sevenDayUtilizationPercent: null,
        sevenDayResetSeconds: null,
        color: 'Y',
        prep: 1,
        hum: 0,
      }),
    ],
  };

  const expectedBody =
    '<tt>M55%&nbsp;C62%&nbsp;🟡D89%&nbsp;cy14</tt><br>\n' +
    '<tt>🔴LA&nbsp;16&nbsp;23&nbsp;40</tt><br>\n' +
    '<tt>pj&nbsp;&nbsp;&nbsp;td&nbsp;qc&nbsp;fl&nbsp;pp&nbsp;ws&nbsp;dp&nbsp;🔴&nbsp;🟡&nbsp;🔵</tt><br>\n' +
    '<tt>🟢ac&nbsp;&nbsp;1&nbsp;&nbsp;2&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;4&nbsp;&nbsp;1&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0</tt><br>\n' +
    '<tt>🟠gl&nbsp;&nbsp;0&nbsp;16&nbsp;&nbsp;6&nbsp;&nbsp;1&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0</tt><br>\n' +
    '<tt>&nbsp;&nbsp;in&nbsp;--&nbsp;--&nbsp;--&nbsp;--&nbsp;--&nbsp;--&nbsp;--&nbsp;--&nbsp;--</tt><br>\n' +
    '<tt>🟣um&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0&nbsp;&nbsp;0</tt><br>\n' +
    '<tt></tt><br>\n' +
    '<tt>' +
    '&nbsp;'.repeat(TOKEN_SESSION_COLUMN_START) +
    '3&nbsp;1</tt><br>\n' +
    '<tt>⚪ob&nbsp;99&nbsp;0d00h00&nbsp;95&nbsp;0d02h00&nbsp;0&nbsp;0</tt><br>\n' +
    '<tt>🟢ce&nbsp;10&nbsp;0d01h00&nbsp;12&nbsp;5d00h00&nbsp;2&nbsp;1</tt><br>\n' +
    '<tt>🟡xx&nbsp;&nbsp;?&nbsp;?&nbsp;&nbsp;?&nbsp;?&nbsp;1&nbsp;0</tt><br>\n';

  it('composes byte-identical dashboard text for representative inputs', () => {
    expect(new ComposeDashboardUseCase().run(representativeInput)).toBe(
      expectedBody,
    );
  });

  it('sorts token rows by seven day reset ascending with null resets last', () => {
    const output = new ComposeDashboardUseCase().run(representativeInput);
    const bobIndex = output.indexOf('⚪ob');
    const aliceIndex = output.indexOf('🟢ce');
    const carolIndex = output.indexOf('🟡xx');
    expect(bobIndex).toBeLessThan(aliceIndex);
    expect(aliceIndex).toBeLessThan(carolIndex);
  });

  it('preserves input order for tokens with equal seven day reset', () => {
    const output = new ComposeDashboardUseCase().run({
      machineStatus: null,
      projects: [],
      tokens: [
        tokenStatus({ name: 'first', sevenDayResetSeconds: 100 }),
        tokenStatus({ name: 'second', sevenDayResetSeconds: 100 }),
        tokenStatus({ name: 'third', sevenDayResetSeconds: 100 }),
      ],
    });
    expect(output.indexOf('st')).toBeLessThan(output.indexOf('nd'));
    expect(output.indexOf('nd')).toBeLessThan(output.indexOf('rd'));
  });

  it('renders host placeholders when the machine status file is absent', () => {
    const output = new ComposeDashboardUseCase().run({
      ...representativeInput,
      machineStatus: null,
    });
    expect(
      output.startsWith(
        '<tt>M?%&nbsp;C?%&nbsp;D?%&nbsp;cy-</tt><br>\n' +
          '<tt>LA&nbsp;?&nbsp;?&nbsp;?</tt><br>\n',
      ),
    ).toBe(true);
  });

  it('keeps every unwrapped composed line within the code point width budget', () => {
    const denseInput: ComposeDashboardInput = {
      machineStatus: {
        memPct: 100,
        cpuPct: 100,
        diskPct: 100,
        load: [108.5, 120.25, 95.1],
        cycleMinutes: 999,
      },
      projects: [
        {
          code: 'ac',
          row: projectRow({
            todo: 999,
            qc: 999,
            fail: 999,
            pr: 999,
            ws: 999,
            dep: 999,
            humanPendingRed: 99,
            humanPendingYellow: 99,
            humanPendingBlue: 99,
          }),
        },
      ],
      tokens: [],
    };
    const output = new ComposeDashboardUseCase().run(denseInput);
    const unwrappedLines = output
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) =>
        line
          .replace(/^<tt>/, '')
          .replace(/<\/tt><br>$/, '')
          .replace(/&nbsp;/g, ' '),
      );
    for (const line of unwrappedLines) {
      expect(codePointLength(line)).toBeLessThanOrEqual(
        PROJECT_ROW_WIDTH_BUDGET,
      );
    }
  });
});

const inDisplayColumns = (tokenRowLine: string): string =>
  ' '.repeat(STATUS_DOT_DISPLAY_WIDTH) + [...tokenRowLine].slice(1).join('');

const sevenDayUtilizationColumnStart = (line: string): number => {
  const chars = [...line];
  return chars.findIndex((c) => c !== ' ');
};

describe('formatSevenDayWindowAggregateLine', () => {
  it('renders only the used value without percent, with no label and no count when every token is included', () => {
    expect(
      formatSevenDayWindowAggregateLine({
        usedPercent: 63,
        includedTokenCount: 10,
        totalTokenCount: 10,
      }),
    ).toBe(' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '63');
  });

  it('places the used value in the same display column as the seven day utilization of every token row', () => {
    const aggregateLine = formatSevenDayWindowAggregateLine({
      usedPercent: 63.36,
      includedTokenCount: 11,
      totalTokenCount: 11,
    });
    expect(sevenDayUtilizationColumnStart(aggregateLine ?? '')).toBe(
      SEVEN_DAY_UTILIZATION_COLUMN_START,
    );
    const colors: TokenStatusColor[] = ['G', 'Y', 'K'];
    for (const color of colors) {
      const tokenRow = formatTokenRowLine(
        tokenStatus({
          name: 'dev4',
          color,
          fiveHourUtilizationPercent: 0,
          fiveHourResetSeconds: 60,
          sevenDayUtilizationPercent: 0,
          sevenDayResetSeconds: 96060,
        }),
      );
      const displayRow = inDisplayColumns(tokenRow);
      const sevenDayCell = [...displayRow]
        .slice(
          SEVEN_DAY_UTILIZATION_COLUMN_START,
          SEVEN_DAY_UTILIZATION_COLUMN_START + TOKEN_UTILIZATION_WIDTH,
        )
        .join('');
      expect(sevenDayCell).toMatch(/^ *\d+$/);
    }
  });

  it('keeps the alignment when the used value needs fewer digits', () => {
    const wide = formatSevenDayWindowAggregateLine({
      usedPercent: 99,
      includedTokenCount: 1,
      totalTokenCount: 1,
    });
    const narrow = formatSevenDayWindowAggregateLine({
      usedPercent: 5,
      includedTokenCount: 1,
      totalTokenCount: 1,
    });
    expect(wide).toBe(' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '99');
    expect(narrow).toBe(
      ' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START + 1) + '5',
    );
    expect(codePointLength(wide ?? '')).toBe(codePointLength(narrow ?? ''));
  });

  it('appends the included token count when some tokens have no value', () => {
    expect(
      formatSevenDayWindowAggregateLine({
        usedPercent: 63,
        includedTokenCount: 9,
        totalTokenCount: 10,
      }),
    ).toBe(' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '63 (9)');
  });

  it('rounds the used value with half-to-even before rendering', () => {
    expect(
      formatSevenDayWindowAggregateLine({
        usedPercent: 62.5,
        includedTokenCount: 2,
        totalTokenCount: 2,
      }),
    ).toBe(' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '62');
    expect(
      formatSevenDayWindowAggregateLine({
        usedPercent: 63.5,
        includedTokenCount: 2,
        totalTokenCount: 2,
      }),
    ).toBe(' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '64');
  });

  it('renders nothing when the aggregate is absent', () => {
    expect(formatSevenDayWindowAggregateLine(null)).toBeNull();
  });

  it('fits the width budget at the widest rendering', () => {
    const line = formatSevenDayWindowAggregateLine({
      usedPercent: 99,
      includedTokenCount: 999,
      totalTokenCount: 1000,
    });
    expect(line).toBe(
      ' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '99 (999)',
    );
    expect(codePointLength(line ?? '')).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
  });
});

describe('ComposeDashboardUseCase seven day window aggregate line', () => {
  const aggregateInput = (
    sevenDayWindowAggregate: ComposeDashboardInput['sevenDayWindowAggregate'],
  ): ComposeDashboardInput => ({
    machineStatus: null,
    projects: [{ code: 'ac', row: projectRow({ todo: 1 }) }],
    tokens: [
      tokenStatus({ name: 'alice', sevenDayUtilizationPercent: 60 }),
      tokenStatus({ name: 'bob', sevenDayUtilizationPercent: 66 }),
    ],
    sevenDayWindowAggregate,
  });

  const unwrappedLines = (output: string): string[] =>
    output
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) =>
        line
          .replace(/^<tt>/, '')
          .replace(/<\/tt><br>$/, '')
          .replace(/&nbsp;/g, ' '),
      );

  it('places the aggregate line immediately above the session total, with the first token row after both', () => {
    const lines = unwrappedLines(
      new ComposeDashboardUseCase().run(
        aggregateInput({
          usedPercent: 63,
          includedTokenCount: 2,
          totalTokenCount: 2,
        }),
      ),
    );
    const aggregateIndex = lines.indexOf(
      ' '.repeat(SEVEN_DAY_UTILIZATION_COLUMN_START) + '63',
    );
    expect(aggregateIndex).toBeGreaterThan(-1);
    expect(lines[aggregateIndex - 1]).toBe(
      formatProjectRowLine({
        code: 'ac',
        row: projectRow({ todo: 1 }),
      }),
    );
    expect(lines[aggregateIndex + 1]).toMatch(/^ +\d+ \d+$/);
    expect(lines[aggregateIndex + 2]).toContain('ce');
  });

  const AGGREGATE_LINE_SHAPE = /^ +\d+( \(\d+\))?$/;

  it('keeps the blank separator line when the aggregate is absent', () => {
    const lines = unwrappedLines(
      new ComposeDashboardUseCase().run(aggregateInput(null)),
    );
    expect(lines.some((line) => AGGREGATE_LINE_SHAPE.test(line))).toBe(false);
    expect(lines).toContain('');
  });

  it('keeps the blank separator line when the aggregate field is missing entirely', () => {
    const lines = unwrappedLines(
      new ComposeDashboardUseCase().run({
        machineStatus: null,
        projects: [],
        tokens: [tokenStatus({ name: 'alice' })],
      }),
    );
    expect(lines.some((line) => AGGREGATE_LINE_SHAPE.test(line))).toBe(false);
    expect(lines).toContain('');
  });
});

describe('formatTokenSessionTotalLine', () => {
  it('returns null when there are no tokens', () => {
    expect(formatTokenSessionTotalLine([])).toBeNull();
  });

  it('sums prep and hum across all tokens at the session column start position', () => {
    const result = formatTokenSessionTotalLine([
      tokenStatus({ name: 'alice', prep: 2, hum: 1 }),
      tokenStatus({ name: 'bob', prep: 0, hum: 0 }),
      tokenStatus({ name: 'carolxx', prep: 1, hum: 0 }),
    ]);
    expect(result).toBe(' '.repeat(TOKEN_SESSION_COLUMN_START) + '3 1');
  });

  it('renders zero totals when all tokens have no assigned sessions', () => {
    const result = formatTokenSessionTotalLine([
      tokenStatus({ name: 'alice', prep: 0, hum: 0 }),
      tokenStatus({ name: 'bob', prep: 0, hum: 0 }),
    ]);
    expect(result).toBe(' '.repeat(TOKEN_SESSION_COLUMN_START) + '0 0');
  });
});
