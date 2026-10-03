import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ClaudeTokenUsage } from '../../domain/entities/ClaudeTokenUsage';
import type { Issue } from '../../domain/entities/Issue';
import type { UrgentStoryLaunchHoldBoardState } from '../../domain/usecases/urgentStoryLaunchHoldDecide';
import { LocalStorageUrgentStoryLaunchHoldRepository } from './LocalStorageUrgentStoryLaunchHoldRepository';

const ALPHA_PROJECT_URL = 'https://github.com/users/alpha-owner/projects/7';
const BETA_PROJECT_URL = 'https://github.com/orgs/beta-org/projects/5';
const DELTA_PROJECT_URL = 'https://github.com/orgs/delta-org/projects/3';
const URGENT_STORY_NAME = 'urgent / production incident';
const REGULAR_STORY_NAME = 'regular / maintenance';
const CLI_COMMAND_LINE_MARKER = 'github-issue-tower-defence-management';
const STATE_DIRECTORY_NAME = 'urgent-story-launch-hold';
const TIMED_OUT_FILE_NAME = 'timed-out-urgent-tasks.json';

const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;

const cliCommandLine = (): string =>
  argv(
    'node',
    `/opt/tdpm/node_modules/${CLI_COMMAND_LINE_MARKER}/bin/adapter/entry-points/cli/index.js`,
    'schedule',
  );

const issueCreate = (
  overrides: Partial<Issue> & Pick<Issue, 'url'>,
): Issue => ({
  nameWithOwner: 'alpha-owner/repo',
  number: 1,
  title: 'Cached issue',
  state: 'OPEN',
  status: 'Awaiting Workspace',
  story: URGENT_STORY_NAME,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  assignees: ['manager-user'],
  labels: [],
  org: 'alpha-owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  author: 'manager-user',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const boardIssueProjection = (
  issue: Pick<
    Issue,
    | 'url'
    | 'story'
    | 'status'
    | 'isClosed'
    | 'dependedIssueUrls'
    | 'nextActionDate'
    | 'nextActionHour'
    | 'assignees'
  >,
) => ({
  url: issue.url,
  story: issue.story,
  status: issue.status,
  isClosed: issue.isClosed,
  dependedIssueUrls: issue.dependedIssueUrls,
  nextActionDate: issue.nextActionDate,
  nextActionHour: issue.nextActionHour,
  assignees: issue.assignees,
});

const boardProjectsProjection = (boardState: UrgentStoryLaunchHoldBoardState) =>
  boardState.projects
    .map((project) => ({
      projectUrl: project.projectUrl,
      readmeMaximumPreparingIssuesCount:
        project.readmeMaximumPreparingIssuesCount,
      issues: project.issues.map(boardIssueProjection),
    }))
    .sort((left, right) =>
      String(left.projectUrl).localeCompare(String(right.projectUrl)),
    );

const readmeWithMaximum = (maximumPreparingIssuesCount: number): string =>
  [
    '# Board',
    '<details>',
    '<summary>config</summary>',
    `maximumPreparingIssuesCount: ${maximumPreparingIssuesCount}`,
    'defaultAgentName: developer',
    '</details>',
  ].join('\n');

const readmeWithoutMaximum = (): string =>
  [
    '# Board',
    '<details>',
    '<summary>config</summary>',
    'defaultAgentName: developer',
    '</details>',
  ].join('\n');

describe('LocalStorageUrgentStoryLaunchHoldRepository', () => {
  let rootDirectory: string;
  let cacheBaseDirectory: string;
  let procDirectory: string;
  let now: Date;
  let nowEpochSeconds: number;

  beforeEach(() => {
    rootDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'urgent-story-launch-hold-'),
    );
    cacheBaseDirectory = path.join(rootDirectory, 'cache');
    procDirectory = path.join(rootDirectory, 'proc');
    fs.mkdirSync(cacheBaseDirectory, { recursive: true });
    fs.mkdirSync(procDirectory, { recursive: true });
    nowEpochSeconds = Math.floor(Date.now() / 1000);
    now = new Date(nowEpochSeconds * 1000);
  });

  afterEach(() => {
    fs.rmSync(rootDirectory, { recursive: true, force: true });
  });

  const repositoryCreate = (
    processId = 9999,
    claudeTokenUsageRepository: ConstructorParameters<
      typeof LocalStorageUrgentStoryLaunchHoldRepository
    >[0]['claudeTokenUsageRepository'] = null,
  ): LocalStorageUrgentStoryLaunchHoldRepository =>
    new LocalStorageUrgentStoryLaunchHoldRepository({
      cacheBaseDirectoryPath: cacheBaseDirectory,
      procDirectoryPath: procDirectory,
      processId,
      claudeTokenUsageRepository,
    });

  const fileModifiedSecondsAgoSet = (
    filePath: string,
    secondsAgo: number,
  ): void => {
    const modifiedEpochSeconds = nowEpochSeconds - secondsAgo;
    fs.utimesSync(filePath, modifiedEpochSeconds, modifiedEpochSeconds);
  };

  const boardCacheFileWrite = (params: {
    projectDirectoryName: string;
    projectId: string;
    content: string;
    modifiedSecondsAgo: number;
  }): void => {
    const boardDirectory = path.join(
      cacheBaseDirectory,
      params.projectDirectoryName,
      `allIssues-${params.projectId}`,
    );
    fs.mkdirSync(boardDirectory, { recursive: true });
    const filePath = path.join(boardDirectory, 'latest.json');
    fs.writeFileSync(filePath, params.content);
    fileModifiedSecondsAgoSet(filePath, params.modifiedSecondsAgo);
  };

  const boardCacheWrite = (params: {
    projectDirectoryName: string;
    projectId: string;
    projectUrl: string;
    issues: Issue[];
    modifiedSecondsAgo: number;
  }): void =>
    boardCacheFileWrite({
      projectDirectoryName: params.projectDirectoryName,
      projectId: params.projectId,
      modifiedSecondsAgo: params.modifiedSecondsAgo,
      content: JSON.stringify({
        lastFetchedAt: now.toISOString(),
        lastFullFetchAt: now.toISOString(),
        project: {
          id: params.projectId,
          url: params.projectUrl,
          databaseId: 1,
          name: params.projectDirectoryName,
          status: { name: 'Status', fieldId: 'status-field', statuses: [] },
        },
        issues: params.issues,
        storyIssueUrlByOptionName: {},
        storyOptions: [],
      }),
    });

  const readmeCacheWrite = (params: {
    projectDirectoryName: string;
    owner: string;
    projectNumber: string;
    readme: string | null;
    modifiedSecondsAgo: number;
  }): void => {
    const readmeDirectory = path.join(
      cacheBaseDirectory,
      params.projectDirectoryName,
      'projectReadme',
      params.owner,
      params.projectNumber,
    );
    fs.mkdirSync(readmeDirectory, { recursive: true });
    const filePath = path.join(readmeDirectory, 'latest.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ fetchedAtMs: now.getTime(), readme: params.readme }),
    );
    fileModifiedSecondsAgoSet(filePath, params.modifiedSecondsAgo);
  };

  const processWrite = (processId: number, commandLine: string): void => {
    const processDirectory = path.join(procDirectory, String(processId));
    fs.mkdirSync(processDirectory, { recursive: true });
    fs.writeFileSync(path.join(processDirectory, 'cmdline'), commandLine);
  };

  const stateDirectory = (): string =>
    path.join(cacheBaseDirectory, STATE_DIRECTORY_NAME);

  const holdingRecordPath = (processId: number): string =>
    path.join(stateDirectory(), 'holding', String(processId));

  const holdingRecordWrite = (processId: number, projectUrl: string): void => {
    fs.mkdirSync(path.join(stateDirectory(), 'holding'), { recursive: true });
    fs.writeFileSync(holdingRecordPath(processId), projectUrl);
  };

  const timedOutRecordPath = (): string =>
    path.join(stateDirectory(), TIMED_OUT_FILE_NAME);

  it('keeps the newest fresh board cache per project id and ignores stale or unparsable board cache files without throwing', async () => {
    const alphaCurrentIssues = [
      issueCreate({
        url: 'https://github.com/alpha-owner/repo/issues/1',
        nextActionDate: new Date('2026-10-02T00:00:00.000Z'),
        nextActionHour: 5,
        dependedIssueUrls: ['https://github.com/alpha-owner/repo/issues/40'],
      }),
      issueCreate({
        url: 'https://github.com/alpha-owner/repo/issues/2',
        status: 'Preparation',
        story: REGULAR_STORY_NAME,
        isClosed: true,
        assignees: ['someone-else'],
      }),
    ];
    const deltaIssues = [
      issueCreate({
        url: 'https://github.com/delta-org/repo/issues/8',
        story: null,
      }),
    ];
    boardCacheWrite({
      projectDirectoryName: 'alpha-current',
      projectId: 'PVT_alpha',
      projectUrl: ALPHA_PROJECT_URL,
      issues: alphaCurrentIssues,
      modifiedSecondsAgo: 100,
    });
    boardCacheWrite({
      projectDirectoryName: 'alpha-previous',
      projectId: 'PVT_alpha',
      projectUrl: ALPHA_PROJECT_URL,
      issues: [
        issueCreate({ url: 'https://github.com/alpha-owner/repo/issues/99' }),
      ],
      modifiedSecondsAgo: 1200,
    });
    boardCacheWrite({
      projectDirectoryName: 'beta',
      projectId: 'PVT_beta',
      projectUrl: BETA_PROJECT_URL,
      issues: [
        issueCreate({ url: 'https://github.com/beta-org/repo/issues/4' }),
      ],
      modifiedSecondsAgo: 4000,
    });
    boardCacheFileWrite({
      projectDirectoryName: 'gamma',
      projectId: 'PVT_gamma',
      content: '{"project": {"id": "PVT_gamma", "url": ',
      modifiedSecondsAgo: 10,
    });
    boardCacheWrite({
      projectDirectoryName: 'delta',
      projectId: 'PVT_delta',
      projectUrl: DELTA_PROJECT_URL,
      issues: deltaIssues,
      modifiedSecondsAgo: 50,
    });

    const boardState = await repositoryCreate().readBoardState(now);

    expect(boardProjectsProjection(boardState)).toEqual([
      {
        projectUrl: DELTA_PROJECT_URL,
        readmeMaximumPreparingIssuesCount: null,
        issues: deltaIssues.map(boardIssueProjection),
      },
      {
        projectUrl: ALPHA_PROJECT_URL,
        readmeMaximumPreparingIssuesCount: null,
        issues: alphaCurrentIssues.map(boardIssueProjection),
      },
    ]);
  });

  it.each<{
    label: string;
    readmeCaches: Array<{
      projectDirectoryName: string;
      readme: string | null;
      modifiedSecondsAgo: number;
    }>;
    expectedMaximumPreparingIssuesCount: number | null;
  }>([
    {
      label: 'reads the maximum from the README cache line',
      readmeCaches: [
        {
          projectDirectoryName: 'alpha',
          readme: readmeWithMaximum(4),
          modifiedSecondsAgo: 500,
        },
      ],
      expectedMaximumPreparingIssuesCount: 4,
    },
    {
      label: 'reads a maximum of zero as zero',
      readmeCaches: [
        {
          projectDirectoryName: 'alpha',
          readme: readmeWithMaximum(0),
          modifiedSecondsAgo: 500,
        },
      ],
      expectedMaximumPreparingIssuesCount: 0,
    },
    {
      label:
        'reads only the newest README cache of the project across project directories',
      readmeCaches: [
        {
          projectDirectoryName: 'alpha',
          readme: readmeWithMaximum(9),
          modifiedSecondsAgo: 3000,
        },
        {
          projectDirectoryName: 'alpha-shared',
          readme: readmeWithMaximum(4),
          modifiedSecondsAgo: 500,
        },
      ],
      expectedMaximumPreparingIssuesCount: 4,
    },
    {
      label:
        'reports no maximum when the newest README cache has no maximum line even though an older one has',
      readmeCaches: [
        {
          projectDirectoryName: 'alpha',
          readme: readmeWithMaximum(9),
          modifiedSecondsAgo: 3000,
        },
        {
          projectDirectoryName: 'alpha-shared',
          readme: readmeWithoutMaximum(),
          modifiedSecondsAgo: 500,
        },
      ],
      expectedMaximumPreparingIssuesCount: null,
    },
    {
      label: 'reports no maximum when the README cache holds no README',
      readmeCaches: [
        {
          projectDirectoryName: 'alpha',
          readme: null,
          modifiedSecondsAgo: 500,
        },
      ],
      expectedMaximumPreparingIssuesCount: null,
    },
    {
      label: 'reports no maximum when the project has no README cache',
      readmeCaches: [],
      expectedMaximumPreparingIssuesCount: null,
    },
  ])(
    '$label',
    async ({ readmeCaches, expectedMaximumPreparingIssuesCount }) => {
      boardCacheWrite({
        projectDirectoryName: 'alpha',
        projectId: 'PVT_alpha',
        projectUrl: ALPHA_PROJECT_URL,
        issues: [
          issueCreate({ url: 'https://github.com/alpha-owner/repo/issues/1' }),
        ],
        modifiedSecondsAgo: 100,
      });
      readmeCaches.forEach((readmeCache) =>
        readmeCacheWrite({
          projectDirectoryName: readmeCache.projectDirectoryName,
          owner: 'alpha-owner',
          projectNumber: '7',
          readme: readmeCache.readme,
          modifiedSecondsAgo: readmeCache.modifiedSecondsAgo,
        }),
      );

      const boardState = await repositoryCreate().readBoardState(now);

      expect(
        boardState.projects.map((project) => ({
          projectUrl: project.projectUrl,
          readmeMaximumPreparingIssuesCount:
            project.readmeMaximumPreparingIssuesCount,
        })),
      ).toEqual([
        {
          projectUrl: ALPHA_PROJECT_URL,
          readmeMaximumPreparingIssuesCount:
            expectedMaximumPreparingIssuesCount,
        },
      ]);
    },
  );

  it('lists the issue URLs of running workers from the process command lines', async () => {
    processWrite(
      1201,
      argv(
        'claude',
        '-p',
        'Take ownership of https://github.com/alpha-owner/repo/issues/3',
      ),
    );
    processWrite(
      1202,
      argv(
        'bash',
        '-c',
        'timeout 3h claude-agent -p "Take ownership of https://github.com/beta-org/repo/issues/9" | tee /logs-aw/worker.log',
      ),
    );
    processWrite(1203, argv('node', 'server.js'));

    const boardState = await repositoryCreate().readBoardState(now);

    expect([...new Set(boardState.runningIssueUrls)].sort()).toEqual([
      'https://github.com/alpha-owner/repo/issues/3',
      'https://github.com/beta-org/repo/issues/9',
    ]);
  });

  it('keeps holding records of processes running the CLI and deletes the ones whose process is gone or runs something else', async () => {
    holdingRecordWrite(2001, ALPHA_PROJECT_URL);
    holdingRecordWrite(2002, BETA_PROJECT_URL);
    holdingRecordWrite(2003, DELTA_PROJECT_URL);
    processWrite(2001, cliCommandLine());
    processWrite(2002, argv('bash'));

    const boardState = await repositoryCreate().readBoardState(now);

    expect(boardState.heldProjectUrls).toEqual([ALPHA_PROJECT_URL]);
    expect(fs.existsSync(holdingRecordPath(2001))).toBe(true);
    expect(fs.existsSync(holdingRecordPath(2002))).toBe(false);
    expect(fs.existsSync(holdingRecordPath(2003))).toBe(false);
  });

  it('ignores timed-out entries recorded more than 1800 seconds ago', async () => {
    fs.mkdirSync(stateDirectory(), { recursive: true });
    fs.writeFileSync(
      timedOutRecordPath(),
      JSON.stringify({
        'https://github.com/beta-org/repo/issues/4': nowEpochSeconds - 600,
        'https://github.com/beta-org/repo/issues/5': nowEpochSeconds - 2400,
      }),
    );

    const boardState = await repositoryCreate().readBoardState(now);

    expect(boardState.timedOutIssueUrls).toEqual([
      'https://github.com/beta-org/repo/issues/4',
    ]);
  });

  it('reads no holding records and no timed-out entries before the state directory exists', async () => {
    boardCacheWrite({
      projectDirectoryName: 'alpha',
      projectId: 'PVT_alpha',
      projectUrl: ALPHA_PROJECT_URL,
      issues: [],
      modifiedSecondsAgo: 100,
    });

    const boardState = await repositoryCreate().readBoardState(now);

    expect(boardState.heldProjectUrls).toEqual([]);
    expect(boardState.timedOutIssueUrls).toEqual([]);
  });

  it('writes a holding record named after its process holding the caller project URL, which another process reads until it is deleted', async () => {
    processWrite(3001, cliCommandLine());
    const holdingRepository = repositoryCreate(3001);
    const observingRepository = repositoryCreate(3002);

    await holdingRepository.createHoldingRecord(ALPHA_PROJECT_URL);
    const recordContent = fs.readFileSync(holdingRecordPath(3001), 'utf8');
    const heldWhileRecorded = (await observingRepository.readBoardState(now))
      .heldProjectUrls;
    await holdingRepository.deleteHoldingRecord();
    const heldAfterDeletion = (await observingRepository.readBoardState(now))
      .heldProjectUrls;

    expect(recordContent.trim()).toBe(ALPHA_PROJECT_URL);
    expect(heldWhileRecorded).toEqual([ALPHA_PROJECT_URL]);
    expect(fs.existsSync(holdingRecordPath(3001))).toBe(false);
    expect(heldAfterDeletion).toEqual([]);
  });

  it('records timed-out issue URLs in epoch seconds and reads them back until 1800 seconds have passed', async () => {
    const repository = repositoryCreate();
    const timedOutIssueUrls = [
      'https://github.com/beta-org/repo/issues/4',
      'https://github.com/delta-org/repo/issues/8',
    ];

    await repository.recordTimedOutIssueUrls(timedOutIssueUrls, now);
    const recorded: unknown = JSON.parse(
      fs.readFileSync(timedOutRecordPath(), 'utf8'),
    );
    const readOneMinuteLater = await repository.readBoardState(
      new Date(now.getTime() + 60 * 1000),
    );
    const readAfterExpiry = await repository.readBoardState(
      new Date(now.getTime() + 1900 * 1000),
    );

    expect(recorded).toEqual({
      'https://github.com/beta-org/repo/issues/4': nowEpochSeconds,
      'https://github.com/delta-org/repo/issues/8': nowEpochSeconds,
    });
    expect(
      fs
        .readdirSync(stateDirectory())
        .filter((fileName) => fileName.endsWith('.tmp')),
    ).toEqual([]);
    expect([...readOneMinuteLater.timedOutIssueUrls].sort()).toEqual(
      timedOutIssueUrls,
    );
    expect(readAfterExpiry.timedOutIssueUrls).toEqual([]);
  });

  it('returns the token usages and in-flight counts of the token usage repository it was given', async () => {
    const tokenUsages: ClaudeTokenUsage[] = [
      {
        name: 'token-a',
        token: 'token-a',
        fiveHourUtilization: 0.2,
        sevenDayUtilization: 0.3,
        blocked: false,
        rejected: false,
        fiveHourRejected: false,
        blockedUntilEpoch: 0,
        modelWeeklyLimits: {},
      },
    ];
    const repository = repositoryCreate(9999, {
      getAvailableTokenUsages: async () => tokenUsages,
      getTokenInFlightCounts: async () => ({ 'token-a': 2 }),
      getPendingTokenLaunchReservationCounts: async () => ({}),
    });

    expect(await repository.getAvailableTokenUsages()).toEqual(tokenUsages);
    expect(await repository.getTokenInFlightCounts()).toEqual({
      'token-a': 2,
    });
  });

  it('delegates pending token launch reservation counts to the token usage repository it was given', async () => {
    const repository = repositoryCreate(9999, {
      getAvailableTokenUsages: async () => [],
      getTokenInFlightCounts: async () => ({}),
      getPendingTokenLaunchReservationCounts: async (tokens: string[]) => {
        expect(tokens).toEqual(['token-a']);
        return { 'token-a': 1 };
      },
    });

    expect(
      await repository.getPendingTokenLaunchReservationCounts(['token-a']),
    ).toEqual({ 'token-a': 1 });
  });

  it('returns no token usages when it was given no token usage repository', async () => {
    expect(
      await repositoryCreate(9999, null).getAvailableTokenUsages(),
    ).toEqual([]);
  });

  it('returns no pending token launch reservation counts when it was given no token usage repository', async () => {
    expect(
      await repositoryCreate(
        9999,
        null,
      ).getPendingTokenLaunchReservationCounts(['token-a']),
    ).toEqual({});
  });
});
