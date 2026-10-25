import { NodeTmuxSessionRepository } from './NodeTmuxSessionRepository';
import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS_NAMES,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from '../../domain/usecases/StaleTmuxSessionKillUseCase';
import { IssueRepository } from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { Issue } from '../../domain/entities/Issue';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
import { Project } from '../../domain/entities/Project';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

type CommandOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const ISSUE_COUNT = 300;
const now = new Date('2026-06-26T00:00:00Z');
const nowEpochSeconds = Math.floor(now.getTime() / 1000);

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

const processTableStdout = [
  '1 0 systemd',
  '1007 1 bash',
  `1008 1007 claude --name ${issueUrlFor(7)}`,
  '4000 1 bash',
  '',
].join('\n');

const listPanesStdout = ['1007 renamed-alpha', '4000 unmapped', ''].join('\n');

const commandSucceeded = (stdout: string): CommandOutput => ({
  stdout,
  stderr: '',
  exitCode: 0,
});

const commandFailed = (stderr: string): CommandOutput => ({
  stdout: '',
  stderr,
  exitCode: 1,
});

const createRunner = (
  liveSessions: LiveTmuxSession[],
  psFailureStderr: string | null,
): Mocked<LocalCommandRunner> => {
  const runner: Mocked<LocalCommandRunner> = {
    runCommand: jest.fn(),
    spawnInteractive: jest.fn(),
  };
  runner.runCommand.mockImplementation(
    async (program: string, args: string[]) => {
      if (program === 'ps')
        return psFailureStderr === null
          ? commandSucceeded(processTableStdout)
          : commandFailed(psFailureStderr);
      if (program === 'tmux' && args[0] === 'list-panes')
        return commandSucceeded(listPanesStdout);
      if (program === 'tmux' && args[0] === 'list-sessions')
        return commandSucceeded(
          liveSessions
            .map(
              (session) =>
                `${session.sessionName} ${session.activityEpochSeconds}`,
            )
            .join('\n'),
        );
      throw new Error(`Unexpected command: ${program} ${args.join(' ')}`);
    },
  );
  return runner;
};

const createUseCase = (
  runner: Mocked<LocalCommandRunner>,
): StaleTmuxSessionKillUseCase => {
  const issueRepository: Mocked<
    Pick<IssueRepository, 'getAllOpened' | 'getIssueByUrl' | 'get'>
  > = {
    getAllOpened: jest.fn().mockResolvedValue(openIssues),
    get: jest.fn().mockResolvedValue(null),
    getIssueByUrl: jest.fn().mockResolvedValue(null),
  };
  return new StaleTmuxSessionKillUseCase(
    issueRepository,
    new NodeTmuxSessionRepository(runner),
  );
};

type TmuxSessionFake = Mocked<
  Pick<
    TmuxSessionRepository,
    'listLiveSessionsWithActivity' | 'killSession'
  > & {
    listSessionNamesForIssueUrl: (issueUrl: string) => Promise<string[]>;
    listSessionNamesForIssueUrls: (
      issueUrls: string[],
    ) => Promise<Map<string, string[]>>;
  }
>;

const sessionNameForIssueNumber = (issueNumber: number): string =>
  `session-${issueNumber}`;

const sessionNamesByIssueUrl = new Map<string, string[]>(
  openIssues.map((issue): [string, string[]] => [
    issue.url,
    [sessionNameForIssueNumber(issue.number)],
  ]),
);

describe('StaleTmuxSessionKillUseCase batch issue session lookup', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs ps once for a run over 300 open issues', async () => {
    const runner = createRunner(
      [
        {
          sessionName: 'renamed-alpha',
          activityEpochSeconds: nowEpochSeconds,
        },
        {
          sessionName: 'no_task_session',
          activityEpochSeconds: nowEpochSeconds,
        },
      ],
      null,
    );
    const useCase = createUseCase(runner);

    await useCase.run({
      project,
      excludedStatusNames: DEFAULT_EXCLUDED_STATUS_NAMES,
      idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
      now,
    });

    const psCalls = runner.runCommand.mock.calls.filter(
      ([program]) => program === 'ps',
    );
    expect(psCalls).toHaveLength(1);
  });

  it('kills no session and rejects with the ps error when ps exits non-zero during a run over 300 open issues', async () => {
    const runner = createRunner(
      [
        {
          sessionName: 'no_task_session',
          activityEpochSeconds:
            nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS,
        },
      ],
      'ps permission denied',
    );
    const useCase = createUseCase(runner);

    await expect(
      useCase.run({
        project,
        excludedStatusNames: DEFAULT_EXCLUDED_STATUS_NAMES,
        idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
        now,
      }),
    ).rejects.toThrow('ps permission denied');

    expect(
      runner.runCommand.mock.calls.filter(
        ([program, args]) =>
          program === 'systemctl' ||
          (program === 'tmux' && args[0] === 'kill-session'),
      ),
    ).toEqual([]);
  });

  it('rejects and kills no session of an open issue that has no batch entry', async () => {
    const failedIssueUrl = issueUrlFor(150);
    const failedSessionName = sessionNameForIssueNumber(150);
    const batchEntries = new Map<string, string[]>(
      Array.from(sessionNamesByIssueUrl).filter(
        ([issueUrl]) => issueUrl !== failedIssueUrl,
      ),
    );
    const tmuxSessionRepository: TmuxSessionFake = {
      listLiveSessionsWithActivity: jest.fn().mockResolvedValue([
        {
          sessionName: failedSessionName,
          activityEpochSeconds:
            nowEpochSeconds - DEFAULT_IDLE_THRESHOLD_SECONDS,
        },
      ]),
      killSession: jest.fn().mockResolvedValue(undefined),
      listSessionNamesForIssueUrl: jest
        .fn()
        .mockImplementation(
          async (issueUrl: string) =>
            sessionNamesByIssueUrl.get(issueUrl) ?? [],
        ),
      listSessionNamesForIssueUrls: jest.fn().mockResolvedValue(batchEntries),
    };
    const issueRepository: Mocked<
      Pick<IssueRepository, 'getAllOpened' | 'getIssueByUrl' | 'get'>
    > = {
      getAllOpened: jest.fn().mockResolvedValue(openIssues),
      get: jest.fn().mockResolvedValue(null),
      getIssueByUrl: jest.fn().mockResolvedValue(null),
    };
    const useCase = new StaleTmuxSessionKillUseCase(
      issueRepository,
      tmuxSessionRepository,
    );

    await expect(
      useCase.run({
        project,
        excludedStatusNames: DEFAULT_EXCLUDED_STATUS_NAMES,
        idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
        now,
      }),
    ).rejects.toThrow();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });
});
