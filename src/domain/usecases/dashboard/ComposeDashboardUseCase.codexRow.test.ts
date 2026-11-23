import { CodexSevenDayWindowStatus } from './CodexSevenDayWindowUseCase';
import {
  codexSevenDayTokenColor,
  formatCodexTokenRowLine,
} from './ComposeDashboardUseCase';

const NOW_EPOCH_SECONDS = Date.UTC(2026, 10, 18, 2, 20, 0) / 1000;
const NOW_MS = NOW_EPOCH_SECONDS * 1000;
const CAPTURED_AT = '2026-11-18T02:16:17.179Z';
const FAR_FUTURE_RESET_EPOCH_SECONDS = 4102444800;
const ALREADY_PASSED_RESET_EPOCH_SECONDS = 1;

const observedWindow = (
  overrides: Partial<CodexSevenDayWindowStatus> = {},
): CodexSevenDayWindowStatus => ({
  codexHome: '.codex',
  state: 'observed',
  usedPercent: 11,
  resetsAtEpochSeconds: NOW_EPOCH_SECONDS + 6 * 86400 + 12 * 3600 + 34 * 60,
  capturedAt: CAPTURED_AT,
  errorMessage: null,
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW_MS);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('codexSevenDayTokenColor', () => {
  const cases: {
    name: string;
    window: CodexSevenDayWindowStatus;
    expected: 'G' | 'Y' | 'K';
  }[] = [
    {
      name: 'is green for an observed window with low utilization',
      window: observedWindow({
        usedPercent: 11,
        resetsAtEpochSeconds: FAR_FUTURE_RESET_EPOCH_SECONDS,
      }),
      expected: 'G',
    },
    {
      name: 'is green at 69 percent, just below the high utilization threshold',
      window: observedWindow({
        usedPercent: 69,
        resetsAtEpochSeconds: FAR_FUTURE_RESET_EPOCH_SECONDS,
      }),
      expected: 'G',
    },
    {
      name: 'is yellow at 70 percent, the high utilization threshold',
      window: observedWindow({
        usedPercent: 70,
        resetsAtEpochSeconds: FAR_FUTURE_RESET_EPOCH_SECONDS,
      }),
      expected: 'Y',
    },
    {
      name: 'is yellow at 99 percent',
      window: observedWindow({
        usedPercent: 99,
        resetsAtEpochSeconds: FAR_FUTURE_RESET_EPOCH_SECONDS,
      }),
      expected: 'Y',
    },
    {
      name: 'is black at 100 percent, the window limit',
      window: observedWindow({
        usedPercent: 100,
        resetsAtEpochSeconds: FAR_FUTURE_RESET_EPOCH_SECONDS,
      }),
      expected: 'K',
    },
    {
      name: 'is green when the window reset has already passed, even at the limit',
      window: observedWindow({
        usedPercent: 100,
        resetsAtEpochSeconds: ALREADY_PASSED_RESET_EPOCH_SECONDS,
      }),
      expected: 'G',
    },
    {
      name: 'is green when the window reset has already passed, even above the high threshold',
      window: observedWindow({
        usedPercent: 70,
        resetsAtEpochSeconds: ALREADY_PASSED_RESET_EPOCH_SECONDS,
      }),
      expected: 'G',
    },
    {
      name: 'is yellow for an error state',
      window: observedWindow({
        state: 'error',
        usedPercent: null,
        resetsAtEpochSeconds: null,
        capturedAt: null,
        errorMessage: 'read failed',
      }),
      expected: 'Y',
    },
    {
      name: 'is yellow for a no data state',
      window: observedWindow({
        state: 'no-data',
        usedPercent: null,
        resetsAtEpochSeconds: null,
        capturedAt: null,
      }),
      expected: 'Y',
    },
  ];

  it.each(cases)('$name', ({ window, expected }) => {
    expect(codexSevenDayTokenColor(window)).toBe(expected);
  });
});

describe('formatCodexTokenRowLine', () => {
  const cases: {
    name: string;
    window: CodexSevenDayWindowStatus;
    runningCodexWorkerCount: number | null;
    expected: string;
  }[] = [
    {
      name: 'renders dot, cx name for the default home, utilization, reset countdown, prep, dash hum and age in minutes',
      window: observedWindow(),
      runningCodexWorkerCount: 2,
      expected: '🟢cx 11 6d12h34  2 - 3m',
    },
    {
      name: 'renders the yellow dot from 70 percent utilization',
      window: observedWindow({ usedPercent: 75 }),
      runningCodexWorkerCount: 2,
      expected: '🟡cx 75 6d12h34  2 - 3m',
    },
    {
      name: 'renders the black dot and caps utilization at 99 at the window limit',
      window: observedWindow({ usedPercent: 100 }),
      runningCodexWorkerCount: 2,
      expected: '⚪cx 99 6d12h34  2 - 3m',
    },
    {
      name: 'names a non-default home with the last two characters of its path',
      window: observedWindow({ codexHome: '.codex-bob' }),
      runningCodexWorkerCount: 2,
      expected: '🟢ob 11 6d12h34  2 - 3m',
    },
    {
      name: 'renders zero utilization and a double dash reset when the reset has already passed',
      window: observedWindow({
        usedPercent: 40,
        resetsAtEpochSeconds: ALREADY_PASSED_RESET_EPOCH_SECONDS,
      }),
      runningCodexWorkerCount: 2,
      expected: `🟢cx  0 ${'--'.padEnd(7)}  2 - 3m`,
    },
    {
      name: 'renders a question mark for the prep count when the running Codex worker count is null',
      window: observedWindow(),
      runningCodexWorkerCount: null,
      expected: '🟢cx 11 6d12h34  ? - 3m',
    },
    {
      name: 'renders question marks and omits the age when the observation has no capture time',
      window: observedWindow({
        state: 'no-data',
        usedPercent: null,
        resetsAtEpochSeconds: null,
        capturedAt: null,
      }),
      runningCodexWorkerCount: 2,
      expected: `🟡cx  ? ${'?'.padEnd(7)}  2 -`,
    },
    {
      name: 'renders question marks for an error and keeps the age when the capture time is present',
      window: observedWindow({
        state: 'error',
        usedPercent: null,
        resetsAtEpochSeconds: null,
        errorMessage: 'read failed',
      }),
      runningCodexWorkerCount: 2,
      expected: `🟡cx  ? ${'?'.padEnd(7)}  2 - 3m`,
    },
  ];

  it.each(cases)('$name', ({ window, runningCodexWorkerCount, expected }) => {
    expect(
      formatCodexTokenRowLine(window, {
        nowMs: NOW_MS,
        runningCodexWorkerCount,
      }),
    ).toBe(expected);
  });
});
