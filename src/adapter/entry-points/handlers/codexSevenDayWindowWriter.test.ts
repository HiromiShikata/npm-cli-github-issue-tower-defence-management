import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CodexRolloutRateLimitReadResult,
  CodexRolloutRateLimitRepository,
} from '../../../domain/usecases/adapter-interfaces/CodexRolloutRateLimitRepository';
import {
  resolveCodexHomeReferences,
  writeCodexSevenDayWindowStatus,
} from './codexSevenDayWindowWriter';

const NOW = new Date('2026-11-18T02:20:00.000Z');

const stubRepository = (
  resultByDirectory: Record<string, CodexRolloutRateLimitReadResult>,
): CodexRolloutRateLimitRepository & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    readLatestSevenDayRateLimit: (directory: string) => {
      calls.push(directory);
      return (
        resultByDirectory[directory] ?? { observation: null, errorMessages: [] }
      );
    },
  };
};

describe('resolveCodexHomeReferences', () => {
  const cases: {
    name: string;
    codexHomeCandidates: string[] | null | undefined;
    codexHomeEnv: string | undefined;
    expected: { label: string; directory: string }[];
  }[] = [
    {
      name: 'resolves each configured candidate name relative to the home directory',
      codexHomeCandidates: ['.codex-a', 'work/.codex-b'],
      codexHomeEnv: '/opt/ignored',
      expected: [
        { label: '.codex-a', directory: '/home/u/.codex-a' },
        { label: 'work/.codex-b', directory: '/home/u/work/.codex-b' },
      ],
    },
    {
      name: 'uses CODEX_HOME when no candidate is configured',
      codexHomeCandidates: null,
      codexHomeEnv: '/opt/codex',
      expected: [{ label: 'codex', directory: '/opt/codex' }],
    },
    {
      name: 'uses the home .codex directory when no candidate and no CODEX_HOME are set',
      codexHomeCandidates: undefined,
      codexHomeEnv: undefined,
      expected: [{ label: '.codex', directory: '/home/u/.codex' }],
    },
    {
      name: 'treats an empty candidate list and an empty CODEX_HOME as unset',
      codexHomeCandidates: [],
      codexHomeEnv: '',
      expected: [{ label: '.codex', directory: '/home/u/.codex' }],
    },
  ];

  it.each(cases)('$name', ({ codexHomeCandidates, codexHomeEnv, expected }) => {
    expect(
      resolveCodexHomeReferences({
        codexHomeCandidates,
        codexHomeEnv,
        homeDirectory: '/home/u',
      }),
    ).toEqual(expected);
  });
});

describe('writeCodexSevenDayWindowStatus', () => {
  let dashboardDataDir: string;

  beforeEach(() => {
    dashboardDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-window-'));
  });

  afterEach(() => {
    fs.rmSync(dashboardDataDir, { recursive: true, force: true });
  });

  const readWritten = (): unknown => {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(
        path.join(dashboardDataDir, 'codex-seven-day-window', 'acme.json'),
        'utf8',
      ),
    );
    return parsed;
  };

  it('writes an observed window per Codex home with its own capture time', () => {
    const repository = stubRepository({
      '/home/u/.codex-a': {
        observation: {
          capturedAt: '2026-11-18T02:16:17.179Z',
          usedPercent: 11,
          resetsAtEpochSeconds: 1795004568,
        },
        errorMessages: [],
      },
    });
    writeCodexSevenDayWindowStatus({
      dashboardDataDir,
      pjcode: 'acme',
      codexHomeCandidates: ['.codex-a'],
      codexHomeEnv: undefined,
      homeDirectory: '/home/u',
      now: NOW,
      repository,
      logError: () => undefined,
    });
    expect(readWritten()).toEqual({
      capturedAt: '2026-11-18T02:20:00.000Z',
      windows: [
        {
          codexHome: '.codex-a',
          state: 'observed',
          usedPercent: 11,
          resetsAtEpochSeconds: 1795004568,
          capturedAt: '2026-11-18T02:16:17.179Z',
          errorMessage: null,
        },
      ],
    });
  });

  it('writes an explicit no-data state when a home has no 7-day observation and no error', () => {
    const repository = stubRepository({});
    writeCodexSevenDayWindowStatus({
      dashboardDataDir,
      pjcode: 'acme',
      codexHomeCandidates: ['.codex-a'],
      codexHomeEnv: undefined,
      homeDirectory: '/home/u',
      now: NOW,
      repository,
      logError: () => undefined,
    });
    expect(readWritten()).toMatchObject({
      windows: [
        {
          codexHome: '.codex-a',
          state: 'no-data',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          capturedAt: null,
          errorMessage: null,
        },
      ],
    });
  });

  it('writes an error state and logs every read error for a home', () => {
    const repository = stubRepository({
      '/home/u/.codex-a': {
        observation: null,
        errorMessages: ['rollout-x.jsonl: Unexpected end of JSON input'],
      },
    });
    const logged: string[] = [];
    writeCodexSevenDayWindowStatus({
      dashboardDataDir,
      pjcode: 'acme',
      codexHomeCandidates: ['.codex-a'],
      codexHomeEnv: undefined,
      homeDirectory: '/home/u',
      now: NOW,
      repository,
      logError: (message) => logged.push(message),
    });
    expect(readWritten()).toMatchObject({
      windows: [
        {
          codexHome: '.codex-a',
          state: 'error',
          usedPercent: null,
          resetsAtEpochSeconds: null,
          capturedAt: null,
          errorMessage: 'rollout-x.jsonl: Unexpected end of JSON input',
        },
      ],
    });
    expect(logged).toEqual([
      'Failed to read Codex rate limits for .codex-a: rollout-x.jsonl: Unexpected end of JSON input',
    ]);
  });

  it('keeps an observation and still logs the errors for the other rollouts', () => {
    const repository = stubRepository({
      '/home/u/.codex-a': {
        observation: {
          capturedAt: '2026-11-17T10:00:00.000Z',
          usedPercent: 5,
          resetsAtEpochSeconds: 1795004568,
        },
        errorMessages: ['rollout-bad.jsonl: bad'],
      },
    });
    const logged: string[] = [];
    writeCodexSevenDayWindowStatus({
      dashboardDataDir,
      pjcode: 'acme',
      codexHomeCandidates: ['.codex-a'],
      codexHomeEnv: undefined,
      homeDirectory: '/home/u',
      now: NOW,
      repository,
      logError: (message) => logged.push(message),
    });
    expect(readWritten()).toMatchObject({
      windows: [expect.objectContaining({ state: 'observed', usedPercent: 5 })],
    });
    expect(logged).toHaveLength(1);
  });

  it('does not read or write anything when the dashboard data directory is not configured', () => {
    const repository = stubRepository({});
    writeCodexSevenDayWindowStatus({
      dashboardDataDir: null,
      pjcode: 'acme',
      codexHomeCandidates: ['.codex-a'],
      codexHomeEnv: undefined,
      homeDirectory: '/home/u',
      now: NOW,
      repository,
      logError: () => undefined,
    });
    expect(repository.calls).toEqual([]);
    expect(fs.readdirSync(dashboardDataDir)).toEqual([]);
  });
});
