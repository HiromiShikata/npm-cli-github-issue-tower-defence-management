import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS_NAMES,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from './StaleTmuxSessionKillUseCase';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Issue } from '../entities/Issue';
import { LiveTmuxSession } from '../entities/LiveTmuxSession';
import { Project } from '../entities/Project';

type TmuxSessionPort = Pick<
  TmuxSessionRepository,
  | 'listLiveSessionsWithActivity'
  | 'killSession'
  | 'listSessionNamesForIssueUrl'
  | 'listSessionNamesForIssueUrls'
>;

type InMemoryTmuxSessionOptions = {
  liveSessions: LiveTmuxSession[];
  sessionNamesByIssueUrl: Map<string, string[]>;
  issueUrlsMissingFromBatch?: string[];
  batchFailure?: Error;
};

class InMemoryTmuxSessionRepository implements TmuxSessionPort {
  readonly batchRequests: string[][] = [];
  readonly perIssueRequests: string[] = [];
  readonly killedSessionNames: string[] = [];

  constructor(private readonly options: InMemoryTmuxSessionOptions) {}

  listLiveSessionsWithActivity = async (): Promise<LiveTmuxSession[]> =>
    this.options.liveSessions;

  killSession = async (sessionName: string): Promise<void> => {
    this.killedSessionNames.push(sessionName);
  };

  listSessionNamesForIssueUrl = async (issueUrl: string): Promise<string[]> => {
    this.perIssueRequests.push(issueUrl);
    return this.options.sessionNamesByIssueUrl.get(issueUrl) ?? [];
  };

  listSessionNamesForIssueUrls = async (
    issueUrls: string[],
  ): Promise<Map<string, string[]>> => {
    this.batchRequests.push(issueUrls);
    if (this.options.batchFailure !== undefined)
      throw this.options.batchFailure;
    const missingUrls = new Set(this.options.issueUrlsMissingFromBatch ?? []);
    return new Map<string, string[]>(
      issueUrls
        .filter((issueUrl) => !missingUrls.has(issueUrl))
        .map((issueUrl): [string, string[]] => [
          issueUrl,
          this.options.sessionNamesByIssueUrl.get(issueUrl) ?? [],
        ]),
    );
  };
}

const ISSUE_COUNT = 300;
const now = new Date('2026-06-26T00:00:00Z');
const nowEpochSeconds = Math.floor(now.getTime() / 1000);
const idleActivityEpochSeconds =
  nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS;

const issueUrlFor = (issueNumber: number): string =>
  `https://github.com/demo/repo/issues/${issueNumber}`;

const createOpenIssue = (issueNumber: number): Issue => ({
  nameWithOwner: 'demo/repo',
  number: issueNumber,
  title: `Open issue ${issueNumber}`,
  state: 'OPEN',
  status: 'In Progress',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: issueUrlFor(issueNumber),
  assignees: [],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: `item-${issueNumber}`,
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
});

const openIssues: Issue[] = Array.from({ length: ISSUE_COUNT }, (_, index) =>
  createOpenIssue(index + 1),
);
const openIssueUrls = openIssues.map((issue) => issue.url);

const project: Project = {
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

const runParams = {
  project,
  excludedStatusNames: DEFAULT_EXCLUDED_STATUS_NAMES,
  idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
  now,
};

const mappedSessionNamesByIssueNumber = new Map<number, string[]>([
  [7, ['session-7']],
  [150, ['session-150']],
  [299, ['session-299']],
]);

const sessionNamesByIssueUrl = new Map<string, string[]>(
  openIssues.map((issue): [string, string[]] => [
    issue.url,
    mappedSessionNamesByIssueNumber.get(issue.number) ?? [],
  ]),
);

const createUseCase = (
  tmuxSessionRepository: TmuxSessionPort,
): StaleTmuxSessionKillUseCase =>
  new StaleTmuxSessionKillUseCase(
    {
      getAllOpened: jest.fn().mockResolvedValue(openIssues),
      get: jest.fn().mockResolvedValue(null),
    },
    tmuxSessionRepository,
  );

describe('StaleTmuxSessionKillUseCase batch issue session lookup', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the session names of all 300 open issue URLs in one batch lookup', async () => {
    const tmuxSessionRepository = new InMemoryTmuxSessionRepository({
      liveSessions: [
        { sessionName: 'session-7', activityEpochSeconds: nowEpochSeconds },
      ],
      sessionNamesByIssueUrl,
    });

    await createUseCase(tmuxSessionRepository).run(runParams);

    expect(tmuxSessionRepository.batchRequests).toEqual([openIssueUrls]);
    expect(tmuxSessionRepository.perIssueRequests).toEqual([]);
  });

  it('kills exactly the sessions mapped to the three matched issues in a run over 300 open issues', async () => {
    const logSpy = jest.spyOn(console, 'log');
    const tmuxSessionRepository = new InMemoryTmuxSessionRepository({
      liveSessions: [7, 150, 299].map((issueNumber) => ({
        sessionName: `session-${issueNumber}`,
        activityEpochSeconds: idleActivityEpochSeconds,
      })),
      sessionNamesByIssueUrl,
    });

    await createUseCase(tmuxSessionRepository).run(runParams);

    expect(tmuxSessionRepository.killedSessionNames).toEqual([
      'session-7',
      'session-150',
      'session-299',
    ]);
    expect(
      logSpy.mock.calls
        .map(([line]) => String(line))
        .filter((line) => line.startsWith('Kill candidate:')),
    ).toEqual([
      expect.stringContaining(
        `Kill candidate: session-7 (mapped to open issue ${issueUrlFor(7)} `,
      ),
      expect.stringContaining(
        `Kill candidate: session-150 (mapped to open issue ${issueUrlFor(150)} `,
      ),
      expect.stringContaining(
        `Kill candidate: session-299 (mapped to open issue ${issueUrlFor(299)} `,
      ),
    ]);
  });

  it('kills no session and records the batch failure for every open issue when the batch lookup rejects', async () => {
    const batchFailure = new Error('ps permission denied');
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const tmuxSessionRepository = new InMemoryTmuxSessionRepository({
      liveSessions: [
        {
          sessionName: 'no_task_session',
          activityEpochSeconds: idleActivityEpochSeconds,
        },
      ],
      sessionNamesByIssueUrl,
      batchFailure,
    });

    await expect(
      createUseCase(tmuxSessionRepository).run(runParams),
    ).rejects.toThrow(
      new Error(openIssues.map(() => 'Error: ps permission denied').join('; ')),
    );

    expect(
      consoleErrorSpy.mock.calls.filter(([message]) =>
        String(message).startsWith('Failed to read live session mapping for '),
      ),
    ).toEqual(
      openIssues.map((issue) => [
        `Failed to read live session mapping for ${issue.url}`,
        batchFailure,
      ]),
    );
    expect(tmuxSessionRepository.batchRequests).toHaveLength(1);
    expect(tmuxSessionRepository.killedSessionNames).toEqual([]);
  });

  it('rejects and kills no session of an open issue that has no batch entry', async () => {
    const tmuxSessionRepository = new InMemoryTmuxSessionRepository({
      liveSessions: [
        {
          sessionName: 'session-150',
          activityEpochSeconds: idleActivityEpochSeconds,
        },
      ],
      sessionNamesByIssueUrl,
      issueUrlsMissingFromBatch: [issueUrlFor(150)],
    });

    await expect(
      createUseCase(tmuxSessionRepository).run(runParams),
    ).rejects.toThrow();
    expect(tmuxSessionRepository.killedSessionNames).toEqual([]);
  });
});
