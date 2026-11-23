import { CodexSevenDayWindowStatus } from './CodexSevenDayWindowUseCase';
import {
  ComposeDashboardInput,
  ComposeDashboardUseCase,
  formatCodexSevenDayWindowLines,
} from './ComposeDashboardUseCase';

const NOW_EPOCH_SECONDS = Date.UTC(2026, 10, 18, 2, 20, 0) / 1000;
const NOW_MS = NOW_EPOCH_SECONDS * 1000;
const CAPTURED_AT = '2026-11-18T02:16:17.179Z';
const RUNNING_COUNT_OPTIONS = { nowMs: NOW_MS, runningCodexWorkerCount: 2 };

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

describe('formatCodexSevenDayWindowLines', () => {
  const cases: {
    name: string;
    windows: CodexSevenDayWindowStatus[] | null;
    runningCodexWorkerCount: number | null;
    expected: string[];
  }[] = [
    {
      name: 'renders an observed window as a token row with cx name, utilization, reset, prep count, dash hum and age',
      windows: [observedWindow()],
      runningCodexWorkerCount: 2,
      expected: ['🟢cx 11 6d12h34  2 - 3m'],
    },
    {
      name: 'rounds the used percent half to even',
      windows: [observedWindow({ usedPercent: 10.5 })],
      runningCodexWorkerCount: 2,
      expected: ['🟢cx 10 6d12h34  2 - 3m'],
    },
    {
      name: 'renders utilization zero and a double dash reset when the window reset has already passed',
      windows: [observedWindow({ resetsAtEpochSeconds: NOW_EPOCH_SECONDS })],
      runningCodexWorkerCount: 2,
      expected: [`🟢cx  0 ${'--'.padEnd(7)}  2 - 3m`],
    },
    {
      name: 'renders a question mark for the prep count when the running Codex worker count is null',
      windows: [observedWindow()],
      runningCodexWorkerCount: null,
      expected: ['🟢cx 11 6d12h34  ? - 3m'],
    },
    {
      name: 'renders question marks and no age when the observation has no capture time',
      windows: [
        observedWindow({
          state: 'no-data',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          capturedAt: null,
        }),
      ],
      runningCodexWorkerCount: 2,
      expected: [`🟡cx  ? ${'?'.padEnd(7)}  2 -`],
    },
    {
      name: 'renders question marks for an error state and still shows the age when the capture time is present',
      windows: [
        observedWindow({
          state: 'error',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          errorMessage: 'read failed',
        }),
      ],
      runningCodexWorkerCount: 2,
      expected: [`🟡cx  ? ${'?'.padEnd(7)}  2 - 3m`],
    },
    {
      name: 'names a non-default Codex home with the last two characters of its path',
      windows: [observedWindow({ codexHome: '.codex-bob' })],
      runningCodexWorkerCount: 2,
      expected: ['🟢ob 11 6d12h34  2 - 3m'],
    },
    {
      name: 'renders a placeholder no data row for the default home when no Codex home is known',
      windows: [],
      runningCodexWorkerCount: 2,
      expected: [`🟡cx  ? ${'?'.padEnd(7)}  2 -`],
    },
    {
      name: 'renders nothing when the windows are not collected yet',
      windows: null,
      runningCodexWorkerCount: 2,
      expected: [],
    },
  ];

  it.each(cases)('$name', ({ windows, runningCodexWorkerCount, expected }) => {
    expect(
      formatCodexSevenDayWindowLines(windows, {
        nowMs: NOW_MS,
        runningCodexWorkerCount,
      }),
    ).toEqual(expected);
  });

  it('keeps one token row per observed window in input order', () => {
    expect(
      formatCodexSevenDayWindowLines(
        [
          observedWindow({ codexHome: '.codex-bob' }),
          observedWindow({ codexHome: '.codex' }),
        ],
        RUNNING_COUNT_OPTIONS,
      ),
    ).toEqual(['🟢ob 11 6d12h34  2 - 3m', '🟢cx 11 6d12h34  2 - 3m']);
  });
});

describe('ComposeDashboardUseCase with Codex seven day windows', () => {
  const baseInput: ComposeDashboardInput = {
    machineStatus: null,
    projects: [],
    tokens: [],
    sevenDayWindowAggregate: null,
    nowMs: NOW_MS,
    codexRunningWorkerCount: 2,
  };

  it('renders the Codex token row when windows are provided', () => {
    const body = new ComposeDashboardUseCase().run({
      ...baseInput,
      codexSevenDayWindows: [observedWindow()],
    });
    expect(body).toContain(
      '<tt>🟢cx&nbsp;11&nbsp;6d12h34&nbsp;&nbsp;2&nbsp;-&nbsp;3m</tt><br>',
    );
  });

  it('does not render any Codex row when windows are not provided', () => {
    const body = new ComposeDashboardUseCase().run(baseInput);
    expect(body).not.toContain('cx&nbsp;');
  });
});
