import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import type { ClaudeTokenUsageRepository } from '../../domain/usecases/adapter-interfaces/ClaudeTokenUsageRepository';
import type { UrgentStoryLaunchHoldRepository } from '../../domain/usecases/adapter-interfaces/UrgentStoryLaunchHoldRepository';
import { isRecord } from '../../domain/usecases/isRecord';
import {
  URGENT_STORY_LAUNCH_HOLD_TIMED_OUT_ISSUE_IGNORED_SECONDS,
  type UrgentStoryLaunchHoldBoardIssue,
  type UrgentStoryLaunchHoldBoardProject,
  type UrgentStoryLaunchHoldBoardState,
} from '../../domain/usecases/urgentStoryLaunchHoldDecide';
import {
  BOARD_CACHE_DIRECTORY_PREFIX,
  BOARD_CACHE_FILE_NAME,
} from './LocalStorageStoryGateBoardCacheRepository';

const URGENT_STORY_LAUNCH_HOLD_DIRECTORY_NAME = 'urgent-story-launch-hold';
const HOLDING_RECORD_DIRECTORY_NAME = 'holding';
const TIMED_OUT_ISSUE_URL_RECORD_FILE_NAME = 'timed-out-urgent-tasks.json';
const PROJECT_README_CACHE_DIRECTORY_NAME = 'projectReadme';
const PROJECT_README_CACHE_FILE_NAME = 'latest.json';
const PROCESS_COMMAND_LINE_FILE_NAME = 'cmdline';
const BOARD_CACHE_MAXIMUM_AGE_MILLISECONDS = 3600 * 1000;
const HOLDING_PROCESS_COMMAND_LINE_MARKER =
  'github-issue-tower-defence-management';
const RUNNING_WORKER_ISSUE_URL_PATTERN =
  /Take ownership of (https:\/\/github\.com\/[^ \0"]+)/;
const PROJECT_URL_OWNER_AND_NUMBER_PATTERN =
  /\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/;
const README_MAXIMUM_PREPARING_ISSUES_COUNT_PATTERN =
  /^\s*maximumPreparingIssuesCount:\s*(\d+)\s*$/m;
const PROCESS_ID_DIRECTORY_NAME_PATTERN = /^\d+$/;
const FILE_ABSENT_ERROR_CODES = ['ENOENT', 'ENOTDIR', 'ESRCH'];

type FileModification = { filePath: string; modifiedAtMilliseconds: number };

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fileSystemReadOrNull = <Content>(
  fileSystemPath: string,
  read: (fileSystemPath: string) => Content,
): Content | null => {
  try {
    return read(fileSystemPath);
  } catch (error) {
    const errorCode =
      isRecord(error) && typeof error.code === 'string' ? error.code : null;
    if (errorCode === null || !FILE_ABSENT_ERROR_CODES.includes(errorCode)) {
      console.warn(
        `Skipping unreadable ${fileSystemPath} in the urgent-story launch hold: ${errorMessageOf(error)}`,
      );
    }
    return null;
  }
};

const directoryEntryNamesList = (directoryPath: string): string[] =>
  fileSystemReadOrNull(directoryPath, (readPath) => fs.readdirSync(readPath)) ??
  [];

const fileTextRead = (filePath: string): string | null =>
  fileSystemReadOrNull(filePath, (readPath) =>
    fs.readFileSync(readPath, 'utf8'),
  );

const fileModificationRead = (filePath: string): FileModification | null => {
  const stats = fileSystemReadOrNull(filePath, (readPath) =>
    fs.statSync(readPath),
  );
  return stats === null
    ? null
    : { filePath, modifiedAtMilliseconds: stats.mtimeMs };
};

const fileJsonRead = (filePath: string): unknown => {
  const content = fileTextRead(filePath);
  if (content === null) {
    return null;
  }
  try {
    const json: unknown = JSON.parse(content);
    return json;
  } catch (error) {
    console.warn(
      `Skipping unparsable ${filePath} in the urgent-story launch hold: ${errorMessageOf(error)}`,
    );
    return null;
  }
};

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const boardIssueParse = (issue: unknown): UrgentStoryLaunchHoldBoardIssue[] => {
  if (!isRecord(issue) || typeof issue.url !== 'string') {
    return [];
  }
  return [
    {
      url: issue.url,
      story: typeof issue.story === 'string' ? issue.story : null,
      status: typeof issue.status === 'string' ? issue.status : null,
      isClosed: issue.isClosed === true,
      dependedIssueUrls: stringsOf(issue.dependedIssueUrls),
      nextActionDate:
        typeof issue.nextActionDate === 'string' && issue.nextActionDate !== ''
          ? new Date(issue.nextActionDate)
          : null,
      nextActionHour:
        typeof issue.nextActionHour === 'number' ? issue.nextActionHour : null,
      assignees: stringsOf(issue.assignees),
    },
  ];
};

export class LocalStorageUrgentStoryLaunchHoldRepository implements UrgentStoryLaunchHoldRepository {
  constructor(
    private readonly input: {
      cacheBaseDirectoryPath: string;
      procDirectoryPath: string;
      processId: number;
      claudeTokenUsageRepository:
        | (Pick<
            ClaudeTokenUsageRepository,
            'getAvailableTokenUsages' | 'getTokenInFlightCounts'
          > & {
            getPendingTokenLaunchReservationCounts: (
              tokens: string[],
            ) => Promise<Record<string, number>>;
          })
        | null;
    },
  ) {}

  readBoardState = async (
    now: Date,
  ): Promise<UrgentStoryLaunchHoldBoardState> => ({
    projects: this.boardProjectsRead(now),
    runningIssueUrls: this.runningIssueUrlsRead(),
    heldProjectUrls: this.heldProjectUrlsRead(),
    timedOutIssueUrls: Object.keys(this.timedOutIssueUrlRecordRead(now)),
  });

  getAvailableTokenUsages = async (): Promise<ClaudeTokenUsage[]> =>
    this.input.claudeTokenUsageRepository === null
      ? []
      : await this.input.claudeTokenUsageRepository.getAvailableTokenUsages();

  getTokenInFlightCounts = async (): Promise<Record<string, number>> =>
    this.input.claudeTokenUsageRepository === null
      ? {}
      : await this.input.claudeTokenUsageRepository.getTokenInFlightCounts();

  getPendingTokenLaunchReservationCounts = async (
    tokens: string[],
  ): Promise<Record<string, number>> =>
    this.input.claudeTokenUsageRepository === null
      ? {}
      : await this.input.claudeTokenUsageRepository.getPendingTokenLaunchReservationCounts(
          tokens,
        );

  createHoldingRecord = async (projectUrl: string | null): Promise<void> => {
    fs.mkdirSync(this.holdingRecordDirectoryPath(), { recursive: true });
    fs.writeFileSync(
      path.join(
        this.holdingRecordDirectoryPath(),
        String(this.input.processId),
      ),
      `${projectUrl ?? ''}\n`,
    );
  };

  deleteHoldingRecord = async (): Promise<void> => {
    fs.rmSync(
      path.join(
        this.holdingRecordDirectoryPath(),
        String(this.input.processId),
      ),
      { force: true },
    );
  };

  recordTimedOutIssueUrls = async (
    issueUrls: string[],
    recordedAt: Date,
  ): Promise<void> => {
    const recordedAtEpochSeconds = Math.floor(recordedAt.getTime() / 1000);
    const timedOutIssueUrlRecord = {
      ...this.timedOutIssueUrlRecordRead(recordedAt),
      ...Object.fromEntries(
        issueUrls.map((issueUrl) => [issueUrl, recordedAtEpochSeconds]),
      ),
    };
    fs.mkdirSync(this.stateDirectoryPath(), { recursive: true });
    const temporaryFilePath = `${this.timedOutIssueUrlRecordFilePath()}.${this.input.processId}.tmp`;
    fs.writeFileSync(temporaryFilePath, JSON.stringify(timedOutIssueUrlRecord));
    fs.renameSync(temporaryFilePath, this.timedOutIssueUrlRecordFilePath());
  };

  private stateDirectoryPath = (): string =>
    path.join(
      this.input.cacheBaseDirectoryPath,
      URGENT_STORY_LAUNCH_HOLD_DIRECTORY_NAME,
    );

  private holdingRecordDirectoryPath = (): string =>
    path.join(this.stateDirectoryPath(), HOLDING_RECORD_DIRECTORY_NAME);

  private timedOutIssueUrlRecordFilePath = (): string =>
    path.join(this.stateDirectoryPath(), TIMED_OUT_ISSUE_URL_RECORD_FILE_NAME);

  private processCommandLineRead = (processIdText: string): string | null =>
    fileTextRead(
      path.join(
        this.input.procDirectoryPath,
        processIdText,
        PROCESS_COMMAND_LINE_FILE_NAME,
      ),
    );

  private boardProjectsRead = (
    now: Date,
  ): UrgentStoryLaunchHoldBoardProject[] => {
    const newestBoardCacheByProjectId = new Map<string, FileModification>();
    for (const projectDirectoryName of directoryEntryNamesList(
      this.input.cacheBaseDirectoryPath,
    )) {
      const projectDirectoryPath = path.join(
        this.input.cacheBaseDirectoryPath,
        projectDirectoryName,
      );
      for (const entryName of directoryEntryNamesList(projectDirectoryPath)) {
        if (!entryName.startsWith(BOARD_CACHE_DIRECTORY_PREFIX)) {
          continue;
        }
        const boardCache = fileModificationRead(
          path.join(projectDirectoryPath, entryName, BOARD_CACHE_FILE_NAME),
        );
        if (
          boardCache === null ||
          now.getTime() - boardCache.modifiedAtMilliseconds >
            BOARD_CACHE_MAXIMUM_AGE_MILLISECONDS
        ) {
          continue;
        }
        const projectId = entryName.slice(BOARD_CACHE_DIRECTORY_PREFIX.length);
        const knownBoardCache = newestBoardCacheByProjectId.get(projectId);
        if (
          knownBoardCache === undefined ||
          knownBoardCache.modifiedAtMilliseconds <
            boardCache.modifiedAtMilliseconds
        ) {
          newestBoardCacheByProjectId.set(projectId, boardCache);
        }
      }
    }
    return Array.from(newestBoardCacheByProjectId.values()).flatMap(
      ({ filePath }) => this.boardProjectRead(filePath),
    );
  };

  private boardProjectRead = (
    boardCacheFilePath: string,
  ): UrgentStoryLaunchHoldBoardProject[] => {
    const boardCache = fileJsonRead(boardCacheFilePath);
    if (boardCache === null) {
      return [];
    }
    const project = isRecord(boardCache) ? boardCache.project : null;
    const projectUrl =
      isRecord(project) && typeof project.url === 'string' ? project.url : null;
    const issues =
      isRecord(boardCache) && Array.isArray(boardCache.issues)
        ? boardCache.issues.flatMap(boardIssueParse)
        : [];
    return [
      {
        projectUrl,
        issues,
        readmeMaximumPreparingIssuesCount:
          this.readmeMaximumPreparingIssuesCountRead(projectUrl),
      },
    ];
  };

  private readmeMaximumPreparingIssuesCountRead = (
    projectUrl: string | null,
  ): number | null => {
    const projectOwnerAndNumber =
      projectUrl === null
        ? null
        : PROJECT_URL_OWNER_AND_NUMBER_PATTERN.exec(projectUrl);
    if (projectOwnerAndNumber === null) {
      return null;
    }
    const newestReadmeCache = directoryEntryNamesList(
      this.input.cacheBaseDirectoryPath,
    )
      .map((projectDirectoryName) =>
        fileModificationRead(
          path.join(
            this.input.cacheBaseDirectoryPath,
            projectDirectoryName,
            PROJECT_README_CACHE_DIRECTORY_NAME,
            projectOwnerAndNumber[1],
            projectOwnerAndNumber[2],
            PROJECT_README_CACHE_FILE_NAME,
          ),
        ),
      )
      .reduce<FileModification | null>(
        (newest, readmeCache) =>
          readmeCache !== null &&
          (newest === null ||
            newest.modifiedAtMilliseconds < readmeCache.modifiedAtMilliseconds)
            ? readmeCache
            : newest,
        null,
      );
    if (newestReadmeCache === null) {
      return null;
    }
    const readmeCache = fileJsonRead(newestReadmeCache.filePath);
    const readme =
      isRecord(readmeCache) && typeof readmeCache.readme === 'string'
        ? readmeCache.readme
        : '';
    const maximumPreparingIssuesCount =
      README_MAXIMUM_PREPARING_ISSUES_COUNT_PATTERN.exec(readme);
    return maximumPreparingIssuesCount === null
      ? null
      : Number(maximumPreparingIssuesCount[1]);
  };

  private runningIssueUrlsRead = (): string[] => {
    const runningIssueUrls = new Set<string>();
    for (const entryName of directoryEntryNamesList(
      this.input.procDirectoryPath,
    )) {
      if (!PROCESS_ID_DIRECTORY_NAME_PATTERN.test(entryName)) {
        continue;
      }
      const commandLine = this.processCommandLineRead(entryName);
      const runningIssueUrl =
        commandLine === null
          ? null
          : RUNNING_WORKER_ISSUE_URL_PATTERN.exec(commandLine);
      if (runningIssueUrl !== null) {
        runningIssueUrls.add(runningIssueUrl[1]);
      }
    }
    return Array.from(runningIssueUrls);
  };

  private heldProjectUrlsRead = (): string[] => {
    const heldProjectUrls = new Set<string>();
    for (const entryName of directoryEntryNamesList(
      this.holdingRecordDirectoryPath(),
    )) {
      const holdingProcessId = Number(entryName);
      if (holdingProcessId === this.input.processId) {
        continue;
      }
      const holdingRecordPath = path.join(
        this.holdingRecordDirectoryPath(),
        entryName,
      );
      const commandLine = Number.isInteger(holdingProcessId)
        ? this.processCommandLineRead(entryName)
        : null;
      if (
        commandLine === null ||
        !commandLine.includes(HOLDING_PROCESS_COMMAND_LINE_MARKER)
      ) {
        fs.rmSync(holdingRecordPath, { force: true });
        continue;
      }
      const projectUrl = (fileTextRead(holdingRecordPath) ?? '').trim();
      if (projectUrl !== '') {
        heldProjectUrls.add(projectUrl);
      }
    }
    return Array.from(heldProjectUrls);
  };

  private timedOutIssueUrlRecordRead = (now: Date): Record<string, number> => {
    const timedOutIssueUrlRecord = fileJsonRead(
      this.timedOutIssueUrlRecordFilePath(),
    );
    if (!isRecord(timedOutIssueUrlRecord)) {
      return {};
    }
    const nowEpochSeconds = now.getTime() / 1000;
    return Object.fromEntries(
      Object.entries(timedOutIssueUrlRecord).flatMap(
        ([issueUrl, timedOutAtEpochSeconds]): Array<[string, number]> => {
          const timedOutAt = Number(timedOutAtEpochSeconds);
          return nowEpochSeconds - timedOutAt <
            URGENT_STORY_LAUNCH_HOLD_TIMED_OUT_ISSUE_IGNORED_SECONDS
            ? [[issueUrl, timedOutAt]]
            : [];
        },
      ),
    );
  };
}
