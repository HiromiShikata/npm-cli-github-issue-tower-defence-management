import { CodexSevenDayWindowStatus } from './CodexSevenDayWindowUseCase';
import {
  ComposeDashboardInput,
  ComposeDashboardUseCase,
  formatCodexSevenDayWindowLines,
} from './ComposeDashboardUseCase';

const NOW_EPOCH_SECONDS = Date.UTC(2026, 10, 18, 2, 20, 0) / 1000;
const NOW_MS = NOW_EPOCH_SECONDS * 1000;
const CAPTURED_AT = '2026-11-18T02:16:17.179Z';

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

describe('formatCodexSevenDayWindowLines', () => {
  const cases: {
    name: string;
    windows: CodexSevenDayWindowStatus[] | null | undefined;
    expected: string[];
  }[] = [
    {
      name: 'renders an observed window with percent, countdown and capture time',
      windows: [observedWindow()],
      expected: ['cx .codex 11% 6d12h34 @11-18 02:16Z'],
    },
    {
      name: 'rounds the used percent half to even',
      windows: [observedWindow({ usedPercent: 10.5 })],
      expected: ['cx .codex 10% 6d12h34 @11-18 02:16Z'],
    },
    {
      name: 'renders reset when the window end is at or before now',
      windows: [observedWindow({ resetsAtEpochSeconds: NOW_EPOCH_SECONDS })],
      expected: ['cx .codex reset @11-18 02:16Z'],
    },
    {
      name: 'renders an explicit no data state',
      windows: [
        observedWindow({
          state: 'no-data',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          capturedAt: null,
        }),
      ],
      expected: ['cx .codex no data'],
    },
    {
      name: 'renders an explicit error state',
      windows: [
        observedWindow({
          state: 'error',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          capturedAt: null,
          errorMessage: 'read failed',
        }),
      ],
      expected: ['cx .codex error'],
    },
    {
      name: 'renders a placeholder no data line when no Codex home is known',
      windows: [],
      expected: ['cx -- no data'],
    },
    {
      name: 'renders nothing when the windows were not provided',
      windows: undefined,
      expected: [],
    },
    {
      name: 'renders nothing when the windows are null',
      windows: null,
      expected: [],
    },
  ];

  it.each(cases)('$name', ({ windows, expected }) => {
    expect(formatCodexSevenDayWindowLines(windows, NOW_EPOCH_SECONDS)).toEqual(
      expected,
    );
  });
});

describe('ComposeDashboardUseCase with Codex seven day windows', () => {
  const baseInput: ComposeDashboardInput = {
    machineStatus: null,
    projects: [],
    tokens: [],
    sevenDayWindowAggregate: null,
    nowMs: NOW_MS,
  };

  it('renders the Codex line when windows are provided', () => {
    const body = new ComposeDashboardUseCase().run({
      ...baseInput,
      codexSevenDayWindows: [observedWindow()],
    });
    expect(body).toContain(
      '<tt>cx&nbsp;.codex&nbsp;11%&nbsp;6d12h34&nbsp;@11-18&nbsp;02:16Z</tt><br>',
    );
  });

  it('does not render any Codex line when windows are not provided', () => {
    const body = new ComposeDashboardUseCase().run(baseInput);
    expect(body).not.toContain('cx&nbsp;');
  });
});
