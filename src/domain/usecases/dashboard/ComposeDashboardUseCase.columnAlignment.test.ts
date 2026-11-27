import { CodexSevenDayWindowStatus } from './CodexSevenDayWindowUseCase';
import {
  ComposeDashboardInput,
  ComposeDashboardUseCase,
  SEVEN_DAY_UTILIZATION_COLUMN_START,
  TOKEN_SESSION_COLUMN_START,
} from './ComposeDashboardUseCase';
import { DashboardRow } from './GenerateDashboardRowUseCase';
import { TokenStatus } from './GenerateTokenStatusUseCase';

const NOW_EPOCH_SECONDS = Date.UTC(2026, 10, 18, 2, 20, 0) / 1000;
const NOW_MS = NOW_EPOCH_SECONDS * 1000;
const CAPTURED_AT = '2026-11-18T02:16:17.179Z';

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

const displayWidthOf = (character: string): number =>
  EMOJI_PATTERN.test(character) ? 2 : 1;

const displayColumnOf = (line: string, search: string): number => {
  const characters = [...line];
  const searchCharacters = [...search];
  const index = characters.findIndex((_, characterIndex) =>
    searchCharacters.every(
      (character, searchIndex) =>
        characters[characterIndex + searchIndex] === character,
    ),
  );
  if (index < 0) {
    throw new Error(`"${search}" not found in "${line}"`);
  }
  return characters
    .slice(0, index)
    .reduce((width, character) => width + displayWidthOf(character), 0);
};

const unwrapTtLines = (body: string): string[] =>
  body
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .replace(/^<tt>/, '')
        .replace(/<\/tt><br>$/, '')
        .replace(/&nbsp;/g, ' '),
    );

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
  consoleTodoByHumanCount: 0,
  consoleAwaitingOwnerCount: 0,
  ...overrides,
});

const noCloseEvents = { h1: 0, h3: 0, h5: 0 };

const tokenStatus = (overrides: Partial<TokenStatus>): TokenStatus => ({
  name: 'token',
  fiveHourUtilizationPercent: 0,
  fiveHourResetSeconds: 0,
  sevenDayUtilizationPercent: 0,
  sevenDayResetSeconds: 0,
  color: 'G',
  prep: 0,
  hum: 0,
  claudeSubagentCount: 0,
  codexSubagentCount: 0,
  ...overrides,
});

const codexWindow: CodexSevenDayWindowStatus = {
  codexHome: '.codex',
  state: 'observed',
  usedPercent: 11,
  resetsAtEpochSeconds: NOW_EPOCH_SECONDS + 6 * 86400 + 12 * 3600 + 34 * 60,
  capturedAt: CAPTURED_AT,
  errorMessage: null,
};

const alignmentInput: ComposeDashboardInput = {
  machineStatus: null,
  projects: [
    {
      code: 'ac',
      row: projectRow({ todo: 1 }),
      closeEventCounts: noCloseEvents,
    },
  ],
  tokens: [
    tokenStatus({
      name: 'alice',
      sevenDayUtilizationPercent: 12,
      sevenDayResetSeconds: 86400 * 5,
      color: 'G',
      prep: 21,
      hum: 34,
    }),
    tokenStatus({
      name: 'bob',
      sevenDayUtilizationPercent: 40,
      sevenDayResetSeconds: 86400 * 3,
      color: 'G',
      prep: 10,
      hum: 7,
    }),
  ],
  sevenDayWindowAggregate: {
    usedPercent: 63,
    includedTokenCount: 2,
    totalTokenCount: 2,
  },
  codexSevenDayWindows: [codexWindow],
  codexRunningWorkerCount: 13,
  nowMs: NOW_MS,
};

describe('ComposeDashboardUseCase token column alignment', () => {
  const lines = unwrapTtLines(
    new ComposeDashboardUseCase().run(alignmentInput),
  );
  const bobRow = lines.find((line) => line.includes('3d00h00')) ?? '';
  const aliceRow = lines.find((line) => line.includes('5d00h00')) ?? '';
  const codexRow = lines.find((line) => line.includes('6d12h34')) ?? '';
  const totalLine = lines[lines.indexOf(bobRow) - 1] ?? '';

  const rowCases: {
    name: string;
    row: string;
    utilization: string;
    reset: string;
    prep: string;
    hum: string;
  }[] = [
    {
      name: 'Claude row of bob',
      row: bobRow,
      utilization: '40',
      reset: '3d00h00',
      prep: '10',
      hum: '7',
    },
    {
      name: 'Claude row of alice',
      row: aliceRow,
      utilization: '12',
      reset: '5d00h00',
      prep: '21',
      hum: '34',
    },
    {
      name: 'Codex row',
      row: codexRow,
      utilization: '11',
      reset: '6d12h34',
      prep: '13',
      hum: '-',
    },
  ];

  it.each(rowCases)('locates the $name in the composed output', ({ row }) => {
    expect(row).not.toBe('');
  });

  it('places the total line directly above the first token row', () => {
    expect(totalLine).toContain('63');
    expect(totalLine).toContain('44');
    expect(totalLine).toContain('41');
  });

  it.each(rowCases)(
    'starts the 7-day utilization, 7-day reset, prep and hum values of the $name at the shared columns',
    ({ row, utilization, reset, prep, hum }) => {
      expect(displayColumnOf(row, utilization)).toBe(
        SEVEN_DAY_UTILIZATION_COLUMN_START,
      );
      expect(displayColumnOf(row, reset)).toBe(
        SEVEN_DAY_UTILIZATION_COLUMN_START + 3,
      );
      expect(displayColumnOf(row, prep)).toBe(TOKEN_SESSION_COLUMN_START);
      expect(displayColumnOf(row, hum)).toBe(TOKEN_SESSION_COLUMN_START + 3);
    },
  );

  it('places the 7-day mean above the 7-day utilization column of the token rows', () => {
    expect(displayColumnOf(totalLine, '63')).toBe(
      SEVEN_DAY_UTILIZATION_COLUMN_START,
    );
  });

  it('places the prep total and the hum total above the prep and hum columns of the token rows', () => {
    expect(displayColumnOf(totalLine, '44')).toBe(TOKEN_SESSION_COLUMN_START);
    expect(displayColumnOf(totalLine, '41')).toBe(
      TOKEN_SESSION_COLUMN_START + 3,
    );
  });

  it('keeps the Claude token rows before the Codex row', () => {
    const bobIndex = lines.indexOf(bobRow);
    const aliceIndex = lines.indexOf(aliceRow);
    const codexIndex = lines.indexOf(codexRow);
    expect(bobIndex).toBeLessThan(aliceIndex);
    expect(aliceIndex).toBeLessThan(codexIndex);
  });
});

const singleDigitTotalsInput: ComposeDashboardInput = {
  ...alignmentInput,
  tokens: [
    tokenStatus({
      name: 'alice',
      sevenDayUtilizationPercent: 12,
      sevenDayResetSeconds: 86400 * 5,
      color: 'G',
      prep: 6,
      hum: 3,
    }),
    tokenStatus({
      name: 'bob',
      sevenDayUtilizationPercent: 40,
      sevenDayResetSeconds: 86400 * 3,
      color: 'G',
      prep: 1,
      hum: 2,
    }),
  ],
  codexRunningWorkerCount: 0,
};

describe('ComposeDashboardUseCase token column alignment with single-digit totals', () => {
  const lines = unwrapTtLines(
    new ComposeDashboardUseCase().run(singleDigitTotalsInput),
  );
  const bobRow = lines.find((line) => line.includes('3d00h00')) ?? '';
  const aliceRow = lines.find((line) => line.includes('5d00h00')) ?? '';
  const codexRow = lines.find((line) => line.includes('6d12h34')) ?? '';
  const totalLine = lines[lines.indexOf(bobRow) - 1] ?? '';

  const rowCases: {
    name: string;
    row: string;
    utilization: string;
    reset: string;
    prep: string;
    hum: string;
  }[] = [
    {
      name: 'Claude row of bob',
      row: bobRow,
      utilization: '40',
      reset: '3d00h00',
      prep: ' 1',
      hum: '2',
    },
    {
      name: 'Claude row of alice',
      row: aliceRow,
      utilization: '12',
      reset: '5d00h00',
      prep: ' 6',
      hum: '3',
    },
    {
      name: 'Codex row',
      row: codexRow,
      utilization: '11',
      reset: '6d12h34',
      prep: ' 0',
      hum: '-',
    },
  ];

  it.each(rowCases)(
    'places the 7-day utilization at column 5, the 7-day reset at column 8, prep at column 16 and hum at column 19 of the $name',
    ({ row, utilization, reset, prep, hum }) => {
      expect(displayColumnOf(row, utilization)).toBe(5);
      expect(displayColumnOf(row, reset)).toBe(8);
      expect(displayColumnOf(row, prep)).toBe(16);
      expect(displayColumnOf(row, hum)).toBe(19);
    },
  );

  it('places the 7-day mean at column 5, the one-digit prep total at column 16 and the one-digit hum total at column 19 of the total line', () => {
    expect(displayColumnOf(totalLine, '63')).toBe(5);
    expect(displayColumnOf(totalLine, ' 7')).toBe(16);
    expect(displayColumnOf(totalLine, '5')).toBe(19);
  });
});
