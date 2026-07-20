import fs from 'fs';
import type { Issue } from '../../../domain/entities/Issue';
import type { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { parseMeminfo, writeSituationFile } from './situationFileWriter';

jest.mock('fs');

const FIXTURE_MEMINFO = `MemTotal:       16384000 kB
MemFree:         4096000 kB
MemAvailable:    8192000 kB
Buffers:          512000 kB
Cached:          3584000 kB
SwapTotal:       4096000 kB
SwapFree:        3072000 kB
SwapCached:            0 kB
`;

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/owner/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2025-01-01'),
  author: 'user',
  closingIssueReferenceUrls: [],
  ...overrides,
});

const baseParams = {
  cachePath: './tmp/cache/test-project',
  projectId: 'PVT_kwHOtest999',
  issues: [],
  statusNames: {
    awaitingQualityCheckStatus: 'Awaiting quality check',
    preparationStatus: 'Preparation',
    awaitingWorkspaceStatus: 'Awaiting workspace',
    failedPreparationStatus: 'Failed Preparation',
  },
  config: {
    maximumPreparingIssuesCount: 6,
    utilizationPercentageThreshold: 90,
    thresholdForAutoReject: 3,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fs.readFileSync).mockReturnValue(FIXTURE_MEMINFO);
  jest.mocked(fs.mkdirSync).mockReturnValue(undefined);
  jest.mocked(fs.writeFileSync).mockReturnValue(undefined);
  jest.mocked(fs.renameSync).mockReturnValue(undefined);
});

describe('parseMeminfo', () => {
  it('parses MemTotal, MemAvailable, SwapTotal, SwapFree from /proc/meminfo fixture', () => {
    const result = parseMeminfo(FIXTURE_MEMINFO);
    expect(result.memTotalKb).toBe(16384000);
    expect(result.memAvailableKb).toBe(8192000);
    expect(result.swapTotalKb).toBe(4096000);
    expect(result.swapFreeKb).toBe(3072000);
  });

  it('returns 0 for missing fields', () => {
    const result = parseMeminfo('MemTotal: 8192000 kB\n');
    expect(result.memAvailableKb).toBe(0);
    expect(result.swapTotalKb).toBe(0);
    expect(result.swapFreeKb).toBe(0);
  });
});

describe('writeSituationFile', () => {
  describe('status counts from issue fixtures', () => {
    it('counts awaitingQualityCheckImmediatelyActionable correctly', async () => {
      const issues = [
        createIssue({
          status: 'Awaiting quality check',
          dependedIssueUrls: [],
          nextActionDate: null,
          nextActionHour: null,
        }),
        createIssue({
          status: 'Awaiting quality check',
          dependedIssueUrls: ['https://github.com/owner/repo/issues/2'],
          nextActionDate: null,
          nextActionHour: null,
        }),
        createIssue({
          status: 'Awaiting quality check',
          dependedIssueUrls: [],
          nextActionDate: new Date('2025-06-01'),
          nextActionHour: null,
        }),
        createIssue({ status: 'Awaiting quality check', nextActionHour: 9 }),
        createIssue({ status: 'Preparation' }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(
          '"awaitingQualityCheckImmediatelyActionable":1',
        ),
      );
    });

    it('excludes closed items without reactivation triggers from immediately actionable counts', async () => {
      const issues = [
        createIssue({
          status: 'Awaiting quality check',
          state: 'CLOSED',
          isClosed: true,
        }),
        createIssue({
          status: 'Awaiting quality check',
          state: 'MERGED',
          isClosed: true,
          isPr: true,
        }),
        createIssue({ status: 'Awaiting quality check' }),
        createIssue({
          status: 'Awaiting workspace',
          state: 'CLOSED',
          isClosed: true,
        }),
        createIssue({ status: 'Awaiting workspace' }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(
          '"awaitingQualityCheckImmediatelyActionable":1',
        ),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"awaitingWorkspaceImmediatelyActionable":1'),
      );
    });

    it('counts preparation total correctly', async () => {
      const issues = [
        createIssue({ status: 'Preparation' }),
        createIssue({ status: 'Preparation' }),
        createIssue({ status: 'Awaiting workspace' }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"preparation":2'),
      );
    });

    it('counts awaitingWorkspaceImmediatelyActionable correctly', async () => {
      const issues = [
        createIssue({
          status: 'Awaiting workspace',
          dependedIssueUrls: [],
          nextActionDate: null,
          nextActionHour: null,
        }),
        createIssue({
          status: 'Awaiting workspace',
          dependedIssueUrls: [],
          nextActionDate: null,
          nextActionHour: null,
        }),
        createIssue({
          status: 'Awaiting workspace',
          dependedIssueUrls: ['https://github.com/owner/repo/issues/10'],
        }),
        createIssue({
          status: 'Awaiting workspace',
          dependedIssueUrls: [],
          nextActionDate: new Date('2025-06-01'),
        }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"awaitingWorkspaceImmediatelyActionable":2'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"awaitingWorkspaceBlockedByDependency":1'),
      );
    });

    it('sets all counts to 0 when statusNames are null', async () => {
      const issues = [
        createIssue({ status: 'Preparation' }),
        createIssue({ status: 'Awaiting workspace' }),
      ];
      const params = {
        ...baseParams,
        statusNames: {
          awaitingQualityCheckStatus: null,
          preparationStatus: null,
          awaitingWorkspaceStatus: null,
          failedPreparationStatus: null,
        },
        issues,
      };

      await writeSituationFile(params);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(
          '"awaitingQualityCheckImmediatelyActionable":0',
        ),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"preparation":0'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"awaitingWorkspaceImmediatelyActionable":0'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"awaitingWorkspaceBlockedByDependency":0'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"failedPreparation":0'),
      );
    });

    it('counts failedPreparation correctly from fixture issues', async () => {
      const issues = [
        createIssue({ status: 'Failed Preparation' }),
        createIssue({ status: 'Failed Preparation' }),
        createIssue({ status: 'Preparation' }),
        createIssue({ status: 'Awaiting workspace' }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"failedPreparation":2'),
      );
    });

    it('sets failedPreparation to 0 when no issues match the failed preparation status', async () => {
      const issues = [
        createIssue({ status: 'Preparation' }),
        createIssue({ status: 'Awaiting workspace' }),
      ];

      await writeSituationFile({ ...baseParams, issues });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"failedPreparation":0'),
      );
    });
  });

  describe('system metrics from /proc/meminfo fixture', () => {
    it('parses memory usedPercent from fixture', async () => {
      await writeSituationFile(baseParams);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"usedPercent":50'),
      );
    });

    it('parses swap usedPercent from fixture', async () => {
      await writeSituationFile(baseParams);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"usedPercent":25'),
      );
    });

    it('includes memory totalGib from fixture', async () => {
      await writeSituationFile(baseParams);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"system"'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"memory"'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"swap"'),
      );
    });

    it('handles zero swap total without division by zero', async () => {
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(
          'MemTotal: 8192000 kB\nMemAvailable: 4096000 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n',
        );

      await writeSituationFile(baseParams);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(
          '"swap":{"usedPercent":0,"usedGib":0,"totalGib":0}',
        ),
      );
    });
  });

  describe('atomic write path', () => {
    it('writes to tmp file then renames to final path', async () => {
      await writeSituationFile(baseParams);

      const expectedFinalPath = `${baseParams.cachePath}/situation-${baseParams.projectId}.json`;
      const expectedTmpPath = `${expectedFinalPath}.tmp`;

      expect(jest.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
        baseParams.cachePath,
        { recursive: true },
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expectedTmpPath,
        expect.any(String),
      );
      expect(jest.mocked(fs.renameSync)).toHaveBeenCalledWith(
        expectedTmpPath,
        expectedFinalPath,
      );
    });

    it('writes mkdirSync before writeFileSync before renameSync', async () => {
      const callOrder: string[] = [];
      jest.mocked(fs.mkdirSync).mockImplementation((): undefined => {
        callOrder.push('mkdir');
        return undefined;
      });
      jest.mocked(fs.writeFileSync).mockImplementation((): void => {
        callOrder.push('write');
      });
      jest.mocked(fs.renameSync).mockImplementation((): void => {
        callOrder.push('rename');
      });

      await writeSituationFile(baseParams);

      expect(callOrder).toEqual(['mkdir', 'write', 'rename']);
    });

    it('written JSON contains config and capturedAt fields', async () => {
      await writeSituationFile(baseParams);

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"capturedAt"'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"maximumPreparingIssuesCount":6'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"utilizationPercentageThreshold":90'),
      );
      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"thresholdForAutoReject":3'),
      );
    });
  });

  describe('running preparation processes', () => {
    it('counts running processes via preparationProcessCheckCommand', async () => {
      const mockRunCommand = jest
        .fn()
        .mockImplementation(async (_program: string, args: string[]) =>
          Promise.resolve({
            stdout: '',
            stderr: '',
            exitCode:
              args[3] === 'https://github.com/owner/repo/issues/1' ? 0 : 1,
          }),
        );
      const mockRunner: LocalCommandRunner = {
        runCommand: mockRunCommand,
      };
      const issues = [
        createIssue({
          status: 'Preparation',
          url: 'https://github.com/owner/repo/issues/1',
          number: 1,
        }),
        createIssue({
          status: 'Preparation',
          url: 'https://github.com/owner/repo/issues/2',
          number: 2,
        }),
      ];

      await writeSituationFile({
        ...baseParams,
        issues,
        preparationProcessCheckCommand: 'pgrep -fa "{URL}"',
        localCommandRunner: mockRunner,
      });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"runningPreparation":1'),
      );
    });

    it('sets runningPreparation to 0 when no preparation issues exist', async () => {
      const mockRunCommand = jest.fn();
      const mockRunner: LocalCommandRunner = {
        runCommand: mockRunCommand,
      };

      await writeSituationFile({
        ...baseParams,
        issues: [],
        preparationProcessCheckCommand: 'pgrep -fa "{URL}"',
        localCommandRunner: mockRunner,
      });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"runningPreparation":0'),
      );
      expect(mockRunCommand).not.toHaveBeenCalled();
    });

    it('sets runningPreparation to null when no localCommandRunner provided', async () => {
      await writeSituationFile({
        ...baseParams,
        preparationProcessCheckCommand: 'pgrep -fa "{URL}"',
      });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"runningPreparation":null'),
      );
    });

    it('sets runningPreparation to null when no preparationProcessCheckCommand', async () => {
      await writeSituationFile({
        ...baseParams,
        preparationProcessCheckCommand: null,
      });

      expect(jest.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"runningPreparation":null'),
      );
    });
  });
});
