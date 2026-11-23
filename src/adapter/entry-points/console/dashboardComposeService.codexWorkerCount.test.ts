import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CodexRunningWorkerRepository } from '../../../domain/usecases/adapter-interfaces/CodexRunningWorkerRepository';
import { writeCodexWorkerCountStatus } from '../handlers/codexWorkerCountWriter';
import { readCodexRunningWorkerCount } from './dashboardComposeService';

const COUNT_FILE_NAME = 'codex-worker-count.json';

describe('readCodexRunningWorkerCount', () => {
  let dataDir: string;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-worker-count-'));
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const cases: {
    name: string;
    fileContent: string | null;
    expected: number | null;
    logged: boolean;
  }[] = [
    {
      name: 'returns the running count from a valid file',
      fileContent: JSON.stringify({
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: 3,
        errorMessage: null,
      }),
      expected: 3,
      logged: false,
    },
    {
      name: 'returns zero from a valid file with no running worker',
      fileContent: JSON.stringify({
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: 0,
        errorMessage: null,
      }),
      expected: 0,
      logged: false,
    },
    {
      name: 'returns null without logging when the file does not exist',
      fileContent: null,
      expected: null,
      logged: false,
    },
    {
      name: 'returns null and logs when the file is not valid JSON',
      fileContent: '{not json',
      expected: null,
      logged: true,
    },
    {
      name: 'returns null and logs when the running count has the wrong type',
      fileContent: JSON.stringify({
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: 'three',
        errorMessage: null,
      }),
      expected: null,
      logged: true,
    },
    {
      name: 'returns null and logs when the writer recorded an error message',
      fileContent: JSON.stringify({
        capturedAt: '2026-11-18T02:20:00.000Z',
        runningIssueCount: null,
        errorMessage: 'proc read failed',
      }),
      expected: null,
      logged: true,
    },
  ];

  it.each(cases)('$name', ({ fileContent, expected, logged }) => {
    if (fileContent !== null) {
      fs.writeFileSync(path.join(dataDir, COUNT_FILE_NAME), fileContent);
    }

    expect(readCodexRunningWorkerCount(dataDir)).toBe(expected);
    if (logged) {
      expect(errorSpy).toHaveBeenCalled();
    } else {
      expect(errorSpy).not.toHaveBeenCalled();
    }
  });

  it('reads back the count that the writer produced, sharing the file name with the writer', () => {
    const repository: CodexRunningWorkerRepository = {
      listRunningCodexWorkerIssueUrls: () => ({
        issueUrls: [
          'https://github.com/HiromiShikata/example/issues/1',
          'https://github.com/HiromiShikata/example/issues/2',
          'https://github.com/HiromiShikata/example/issues/3',
          'https://github.com/HiromiShikata/example/issues/4',
        ],
        errorMessages: [],
      }),
    };
    writeCodexWorkerCountStatus({
      dashboardDataDir: dataDir,
      repository,
      now: new Date('2026-11-18T02:20:00.000Z'),
      logError: jest.fn(),
    });

    expect(readCodexRunningWorkerCount(dataDir)).toBe(4);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reads back null and logs when the writer recorded a repository error', () => {
    const repository: CodexRunningWorkerRepository = {
      listRunningCodexWorkerIssueUrls: () => ({
        issueUrls: [],
        errorMessages: ['cannot read proc directory'],
      }),
    };
    writeCodexWorkerCountStatus({
      dashboardDataDir: dataDir,
      repository,
      now: new Date('2026-11-18T02:20:00.000Z'),
      logError: jest.fn(),
    });

    expect(readCodexRunningWorkerCount(dataDir)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});
