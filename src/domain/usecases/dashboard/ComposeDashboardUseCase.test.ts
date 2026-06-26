import {
  ComposeDashboardInput,
  ComposeDashboardUseCase,
  PROJECT_ROW_WIDTH_BUDGET,
  formatMachineStatusLine,
  formatProjectHeaderLine,
  formatProjectRowLine,
  formatResetCountdown,
  formatTokenRowLine,
  roundHalfToEven,
} from './ComposeDashboardUseCase';
import { DashboardRow } from './GenerateDashboardRowUseCase';
import { TokenStatus } from './GenerateTokenStatusUseCase';

const codePointLength = (value: string): number => [...value].length;

const projectRow = (overrides: Partial<DashboardRow>): DashboardRow => ({
  unread: 0,
  todo: 0,
  qc: 0,
  fail: 0,
  pr: 0,
  ws: 0,
  dep: 0,
  blocker: 0,
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

describe('formatMachineStatusLine', () => {
  it('renders the host-metrics line from a machine status', () => {
    expect(
      formatMachineStatusLine({
        memPct: 55,
        cpuPct: 62,
        load: [16, 23, 40],
        cycleMinutes: 14,
      }),
    ).toBe('M55% C62% LA 16 23 40 cy14');
  });

  it('rounds loads with half-to-even and renders integers', () => {
    expect(
      formatMachineStatusLine({
        memPct: 62,
        cpuPct: 31,
        load: [1.2, 0.98, 0.75],
        cycleMinutes: 14,
      }),
    ).toBe('M62% C31% LA 1 1 1 cy14');
  });

  it('falls back to placeholders when the machine status is absent', () => {
    expect(formatMachineStatusLine(null)).toBe('M?% C?% LA ? ? ? cy-');
  });

  it('renders cy- when cycle minutes is null', () => {
    expect(
      formatMachineStatusLine({
        memPct: 1,
        cpuPct: 2,
        load: [0, 0, 0],
        cycleMinutes: null,
      }),
    ).toBe('M1% C2% LA 0 0 0 cy-');
  });

  it('stays within the 32 character width budget at worst case', () => {
    const line = formatMachineStatusLine({
      memPct: 100,
      cpuPct: 100,
      load: [108.5, 120.25, 95.1],
      cycleMinutes: 999,
    });
    expect(line).toBe('M100% C100% LA 108 120 95 cy999');
    expect(codePointLength(line)).toBeLessThanOrEqual(PROJECT_ROW_WIDTH_BUDGET);
  });
});

describe('formatProjectHeaderLine', () => {
  it('renders the fixed project grid header', () => {
    expect(formatProjectHeaderLine()).toBe('pj   unr tdo aqc fal prp aws dep');
  });

  it('fits the 32 character width budget exactly', () => {
    expect(codePointLength(formatProjectHeaderLine())).toBe(
      PROJECT_ROW_WIDTH_BUDGET,
    );
  });
});

describe('formatProjectRowLine', () => {
  it('renders a present row with its severity dot and counts', () => {
    expect(
      formatProjectRowLine({
        code: 'um',
        row: projectRow({ unread: 3, todo: 1, qc: 2, ws: 4, dep: 1 }),
      }),
    ).toBe('🟢um   3   1   2   0   0   4   1');
  });

  it('renders placeholder cells with a blank dot for an absent project file', () => {
    expect(formatProjectRowLine({ code: 'xc', row: null })).toBe(
      '  xc  --  --  --  --  --  --  --',
    );
  });

  it('caps a count above 999 at 999', () => {
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ unread: 1500 }) }),
    ).toBe('🟠um 999   0   0   0   0   0   0');
  });

  it('applies the five level severity dot rules in descending order', () => {
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ blocker: 2 }) }),
    ).toContain('🔴');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ blocker: 1 }) }),
    ).toContain('🟣');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ unread: 10 }) }),
    ).toContain('🟠');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ qc: 15 }) }),
    ).toContain('🟠');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ fail: 5 }) }),
    ).toContain('🟠');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ unread: 5 }) }),
    ).toContain('🟡');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ qc: 10 }) }),
    ).toContain('🟡');
    expect(
      formatProjectRowLine({ code: 'um', row: projectRow({ fail: 3 }) }),
    ).toContain('🟡');
    expect(
      formatProjectRowLine({
        code: 'um',
        row: projectRow({ unread: 4, qc: 9, fail: 2 }),
      }),
    ).toContain('🟢');
  });

  it('keeps present and absent rows within the 32 code point width budget', () => {
    const present = formatProjectRowLine({
      code: 'xm',
      row: projectRow({
        unread: 999,
        todo: 999,
        qc: 999,
        fail: 999,
        pr: 999,
        ws: 999,
        dep: 999,
      }),
    });
    const absent = formatProjectRowLine({ code: 'xc', row: null });
    expect(codePointLength(present)).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
    expect(codePointLength(absent)).toBeLessThanOrEqual(
      PROJECT_ROW_WIDTH_BUDGET,
    );
  });
});

describe('formatTokenRowLine', () => {
  it('renders a token row with utilization, reset countdown, prep and hum', () => {
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
    ).toBe('🟢alice  10% 0d01h00  12% 5d00h00 2 1');
  });

  it('pads short names to four characters with underscores', () => {
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
    ).toBe('⚪bob_ 100% 0d00h00  95% 0d02h00 0 0');
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
    ).toBe('🟡carolxx    ? ?    ? ? 1 0');
  });
});

describe('ComposeDashboardUseCase', () => {
  const representativeInput: ComposeDashboardInput = {
    machineStatus: {
      memPct: 55,
      cpuPct: 62,
      load: [16, 23, 40],
      cycleMinutes: 14,
    },
    projects: [
      {
        code: 'um',
        row: projectRow({ unread: 3, todo: 1, qc: 2, ws: 4, dep: 1 }),
      },
      {
        code: 'xm',
        row: projectRow({ unread: 12, qc: 16, fail: 6, pr: 1 }),
      },
      { code: 'xc', row: null },
      { code: 'ut', row: projectRow({ blocker: 1 }) },
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
    '<tt>M55%&nbsp;C62%&nbsp;LA&nbsp;16&nbsp;23&nbsp;40&nbsp;cy14</tt><br>\n' +
    '<tt>pj&nbsp;&nbsp;&nbsp;unr&nbsp;tdo&nbsp;aqc&nbsp;fal&nbsp;prp&nbsp;aws&nbsp;dep</tt><br>\n' +
    '<tt>🟢um&nbsp;&nbsp;&nbsp;3&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;4&nbsp;&nbsp;&nbsp;1</tt><br>\n' +
    '<tt>🟠xm&nbsp;&nbsp;12&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;16&nbsp;&nbsp;&nbsp;6&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0</tt><br>\n' +
    '<tt>&nbsp;&nbsp;xc&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--&nbsp;&nbsp;--</tt><br>\n' +
    '<tt>🟣ut&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;0</tt><br>\n' +
    '<tt></tt><br>\n' +
    '<tt>⚪bob_&nbsp;100%&nbsp;0d00h00&nbsp;&nbsp;95%&nbsp;0d02h00&nbsp;0&nbsp;0</tt><br>\n' +
    '<tt>🟢alice&nbsp;&nbsp;10%&nbsp;0d01h00&nbsp;&nbsp;12%&nbsp;5d00h00&nbsp;2&nbsp;1</tt><br>\n' +
    '<tt>🟡carolxx&nbsp;&nbsp;&nbsp;&nbsp;?&nbsp;?&nbsp;&nbsp;&nbsp;&nbsp;?&nbsp;?&nbsp;1&nbsp;0</tt><br>\n';

  it('composes byte-identical dashboard text for representative inputs', () => {
    expect(new ComposeDashboardUseCase().run(representativeInput)).toBe(
      expectedBody,
    );
  });

  it('sorts token rows by seven day reset ascending with null resets last', () => {
    const output = new ComposeDashboardUseCase().run(representativeInput);
    const bobIndex = output.indexOf('⚪bob_');
    const aliceIndex = output.indexOf('🟢alice');
    const carolIndex = output.indexOf('🟡carolxx');
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
    expect(output.indexOf('first')).toBeLessThan(output.indexOf('second'));
    expect(output.indexOf('second')).toBeLessThan(output.indexOf('third'));
  });

  it('renders host placeholders when the machine status file is absent', () => {
    const output = new ComposeDashboardUseCase().run({
      ...representativeInput,
      machineStatus: null,
    });
    expect(
      output.startsWith(
        '<tt>M?%&nbsp;C?%&nbsp;LA&nbsp;?&nbsp;?&nbsp;?&nbsp;cy-</tt><br>\n',
      ),
    ).toBe(true);
  });

  it('keeps every unwrapped composed line within the 32 code point width budget', () => {
    const denseInput: ComposeDashboardInput = {
      machineStatus: {
        memPct: 100,
        cpuPct: 100,
        load: [108.5, 120.25, 95.1],
        cycleMinutes: 999,
      },
      projects: [
        {
          code: 'um',
          row: projectRow({
            unread: 999,
            todo: 999,
            qc: 999,
            fail: 999,
            pr: 999,
            ws: 999,
            dep: 999,
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
