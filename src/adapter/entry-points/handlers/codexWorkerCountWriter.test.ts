import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CodexRunningWorkerListResult,
  CodexRunningWorkerRepository,
} from '../../../domain/usecases/adapter-interfaces/CodexRunningWorkerRepository';
import { writeCodexWorkerCountStatus } from './codexWorkerCountWriter';

const NOW = new Date('2026-11-18T02:20:00.000Z');
const COUNT_FILE_NAME = 'codex-worker-count.json';

type RepositoryBehavior = CodexRunningWorkerListResult | Error;

const repositoryReturning = (
  behavior: RepositoryBehavior,
): CodexRunningWorkerRepository => ({
  listRunningCodexWorkerIssueUrls: () => {
    if (behavior instanceof Error) {
      throw behavior;
    }
    return behavior;
  },
});

describe('writeCodexWorkerCountStatus', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-worker-count-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const readCountFile = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(path.join(dataDir, COUNT_FILE_NAME), 'utf8'));

  const cases: {
    name: string;
    behavior: RepositoryBehavior;
    expectedFile: {
      capturedAt: string;
      runningIssueCount: number | null;
      errorMessageFragment: string | null;
    };
    loggedFragment: string | null;
  }[] = [
    {
      name: 'writes the number of distinct running issues when the listing has no error',
      behavior: {
        issueUrls: [
          'https://github.com/HiromiShikata/example/issues/1',
          'https://github.com/HiromiShikata/example/issues/2',
        ],
        errorMessages: [],
      },
      expectedFile: {
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: 2,
        errorMessageFragment: null,
      },
      loggedFragment: null,
    },
    {
      name: 'writes zero when no Codex worker is running and logs nothing',
      behavior: { issueUrls: [], errorMessages: [] },
      expectedFile: {
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: 0,
        errorMessageFragment: null,
      },
      loggedFragment: null,
    },
    {
      name: 'writes a null count with the error message and logs it when the listing reports an error',
      behavior: {
        issueUrls: ['https://github.com/HiromiShikata/example/issues/1'],
        errorMessages: ['cannot read proc directory'],
      },
      expectedFile: {
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: null,
        errorMessageFragment: 'cannot read proc directory',
      },
      loggedFragment: 'cannot read proc directory',
    },
    {
      name: 'writes a null count with the thrown message and logs it when the repository throws',
      behavior: new Error('proc exploded'),
      expectedFile: {
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: null,
        errorMessageFragment: 'proc exploded',
      },
      loggedFragment: 'proc exploded',
    },
  ];

  it.each(cases)('$name', ({ behavior, expectedFile, loggedFragment }) => {
    const logError = jest.fn<void, [string]>();

    writeCodexWorkerCountStatus({
      dashboardDataDir: dataDir,
      repository: repositoryReturning(behavior),
      now: NOW,
      logError,
    });

    const written = readCountFile();
    expect(written.capturedAt).toBe(expectedFile.capturedAt);
    expect(written.runningIssueCount).toBe(expectedFile.runningIssueCount);
    if (expectedFile.errorMessageFragment === null) {
      expect(written.errorMessage).toBeNull();
    } else {
      expect(written.errorMessage).toEqual(
        expect.stringContaining(expectedFile.errorMessageFragment),
      );
    }
    if (loggedFragment === null) {
      expect(logError).not.toHaveBeenCalled();
    } else {
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining(loggedFragment),
      );
    }
  });

  it('leaves only the count file in the data directory after writing', () => {
    writeCodexWorkerCountStatus({
      dashboardDataDir: dataDir,
      repository: repositoryReturning({
        issueUrls: ['https://github.com/HiromiShikata/example/issues/1'],
        errorMessages: [],
      }),
      now: NOW,
      logError: jest.fn(),
    });

    expect(fs.readdirSync(dataDir)).toEqual([COUNT_FILE_NAME]);
  });

  it.each([
    { name: 'null', dashboardDataDir: null },
    { name: 'undefined', dashboardDataDir: undefined },
    { name: 'an empty string', dashboardDataDir: '' },
  ])(
    'does not query the repository or log when the dashboard data directory is $name',
    ({ dashboardDataDir }) => {
      const listRunningCodexWorkerIssueUrls = jest.fn(() => ({
        issueUrls: [],
        errorMessages: [],
      }));
      const logError = jest.fn<void, [string]>();

      writeCodexWorkerCountStatus({
        dashboardDataDir,
        repository: { listRunningCodexWorkerIssueUrls },
        now: NOW,
        logError,
      });

      expect(listRunningCodexWorkerIssueUrls).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
    },
  );
});
