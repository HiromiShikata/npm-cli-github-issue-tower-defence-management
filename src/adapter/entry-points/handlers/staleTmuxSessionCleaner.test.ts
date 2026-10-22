import * as fs from 'fs';

jest.mock('fs', () => {
  const actualFs: typeof fs = jest.requireActual('fs');
  return { ...actualFs, readFileSync: jest.fn(actualFs.readFileSync) };
});

import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import {
  IN_TMUX_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
} from '../../../domain/entities/WorkflowStatus';
import { cleanStaleTmuxSessions } from './staleTmuxSessionCleaner';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
const makeProject = (): Project => ({
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
});

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: IN_TMUX_STATUS_NAME,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
  spawnInteractive: jest.fn(),
});

const createMockIssueRepository = (
  issues: Issue[],
): Pick<IssueRepository, 'getAllOpened' | 'getIssueByUrl' | 'get'> => ({
  getAllOpened: jest.fn().mockResolvedValue(issues),
  get: jest
    .fn()
    .mockImplementation(
      async (url: string) => issues.find((issue) => issue.url === url) ?? null,
    ),
  getIssueByUrl: jest
    .fn()
    .mockImplementation(
      async (url) => issues.find((issue) => issue.url === url) ?? null,
    ),
});

const sessionIdentityCommandResult = (
  program: string,
  args: string[],
): { stdout: string; stderr: string; exitCode: number } => {
  if (program === 'tmux' && args[0] === 'list-panes')
    return {
      stdout:
        '91001 https_//github_com/demo/repo/issues/1\n91002 idle_no_task\n91003 recent_no_task\n',
      stderr: '',
      exitCode: 0,
    };
  if (program === 'ps')
    return {
      stdout:
        '91001 1 claude --name https://github.com/demo/repo/issues/1\n91002 1 bash\n91003 1 bash\n',
      stderr: '',
      exitCode: 0,
    };
  return { stdout: '', stderr: '', exitCode: 0 };
};

const createRunnerForSessions = (
  sessions: { name: string; issueUrl?: string }[],
  listSessionsResult: { stdout: string; stderr: string; exitCode: number } = {
    stdout: sessions
      .map(({ name }) => `${name} ${NOW_EPOCH_SECONDS}`)
      .join('\n'),
    stderr: '',
    exitCode: 0,
  },
): Mocked<LocalCommandRunner> => {
  const runner = createMockRunner();
  runner.runCommand.mockImplementation(async (program, args) => {
    if (program === 'tmux' && args[0] === 'list-sessions')
      return args[2] === '#{session_name}'
        ? {
            ...listSessionsResult,
            stdout: sessions.map(({ name }) => name).join('\n'),
          }
        : listSessionsResult;
    if (program === 'tmux' && args[0] === 'list-panes')
      return {
        stdout: sessions
          .map(({ name }, index) => `9100${index + 1} ${name}`)
          .join('\n'),
        stderr: '',
        exitCode: 0,
      };
    if (program === 'ps')
      return {
        stdout: sessions
          .map(
            ({ name, issueUrl }, index) =>
              `9100${index + 1} 1 claude --name ${issueUrl ?? name}`,
          )
          .join('\n'),
        stderr: '',
        exitCode: 0,
      };
    return { stdout: '', stderr: '', exitCode: 0 };
  });
  return runner;
};

describe('cleanStaleTmuxSessions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const actualFs = jest.requireActual<typeof fs>('fs');
    jest.mocked(fs.readFileSync).mockImplementation((filePath, options) => {
      if (
        typeof filePath === 'string' &&
        /^\/proc\/9100\d+\/cgroup$/.test(filePath)
      )
        return '0::/user.slice/user-1000.slice/user@1000.service/app.slice/terminal.service\n';
      if (typeof filePath === 'string' && filePath.startsWith('/proc/'))
        throw new Error(
          'Unexpected real process read in constructed session fixture',
        );
      return actualFs.readFileSync(filePath, options);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('kills a session mapping to an open issue whose status is not the excluded status and is idle at least 24 hours', async () => {
    const runner = createMockRunner();
    const idleActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60;
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${idleActivity}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return sessionIdentityCommandResult(program, args);
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ status: 'In Progress' }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCall?.[1]).toEqual([
      'kill-session',
      '-t',
      '=https_//github_com/demo/repo/issues/1',
    ]);
  });

  it('does not kill an excluded-status session that has no reactivation trigger', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${NOW_EPOCH_SECONDS}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return sessionIdentityCommandResult(program, args);
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ status: IN_TMUX_STATUS_NAME }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCalls).toHaveLength(0);
  });

  it('never kills an "In Tmux by agent" session even when idle at least 24 hours', async () => {
    const runner = createMockRunner();
    const idleActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60;
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${idleActivity}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return sessionIdentityCommandResult(program, args);
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ status: IN_TMUX_BY_AGENT_STATUS_NAME }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCalls).toHaveLength(0);
  });

  it('kills a no-task session idle at least 24 hours and spares a recently active one', async () => {
    const runner = createMockRunner();
    const idleActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60;
    const recentActivity = NOW_EPOCH_SECONDS - 24 * 60 * 60 + 1;
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: `idle_no_task ${idleActivity}\nrecent_no_task ${recentActivity}\n`,
          stderr: '',
          exitCode: 0,
        };
      }
      return sessionIdentityCommandResult(program, args);
    });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([]),
      localCommandRunner: runner,
      now: NOW,
    });

    const killCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'kill-session',
    );
    expect(killCalls).toHaveLength(1);
    expect(killCalls[0][1]).toEqual(['kill-session', '-t', '=idle_no_task']);
  });
  it('runs cleanup when launch is disabled', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions')
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${NOW_EPOCH_SECONDS}\n`,
          stderr: '',
          exitCode: 0,
        };
      return sessionIdentityCommandResult(program, args);
    });
    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: createMockIssueRepository([
        makeIssue({ nextActionHour: 0 }),
      ]),
      localCommandRunner: runner,
      now: NOW,
    });
    expect(
      runner.runCommand.mock.calls.some(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      ),
    ).toBe(true);
    expect(
      runner.runCommand.mock.calls.some(
        ([program, args]) => program === 'tmux' && args[0] === 'new-session',
      ),
    ).toBe(false);
  });
  it('does not read a live issue when the snapshot says it is unheld', async () => {
    const project = makeProject();
    const issue = makeIssue();
    const repository = createMockIssueRepository([issue]);
    repository.get = jest
      .fn()
      .mockResolvedValue({ ...issue, nextActionHour: 0 });
    repository.getIssueByUrl = jest.fn().mockResolvedValue(issue);
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions')
        return {
          stdout: `https_//github_com/demo/repo/issues/1 ${NOW_EPOCH_SECONDS}\n`,
          stderr: '',
          exitCode: 0,
        };
      return sessionIdentityCommandResult(program, args);
    });
    await cleanStaleTmuxSessions({
      project,
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });
    expect(repository.get).not.toHaveBeenCalled();
    expect(repository.getIssueByUrl).not.toHaveBeenCalled();
    expect(
      runner.runCommand.mock.calls.some(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      ),
    ).toBe(false);
  });

  it('AC1: issues zero live reads when 1,000 open issues have no live sessions', async () => {
    const issues = Array.from({ length: 1000 }, (_, index) =>
      makeIssue({
        number: index + 1,
        url: `https://github.com/demo/repo/issues/${index + 1}`,
      }),
    );
    const repository = createMockIssueRepository(issues);
    const runner = createRunnerForSessions([]);

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    expect(repository.get).not.toHaveBeenCalled();
  });

  it('AC2: issues zero live reads for five live sessions mapped to snapshot-unheld issues', async () => {
    const issues = Array.from({ length: 5 }, (_, index) =>
      makeIssue({
        number: index + 1,
        url: `https://github.com/demo/repo/issues/${index + 1}`,
      }),
    );
    const runner = createRunnerForSessions(
      issues.map((issue, index) => ({
        name: `renamed-${index}`,
        issueUrl: issue.url,
      })),
    );
    const repository = createMockIssueRepository(issues);

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    expect(repository.get).not.toHaveBeenCalled();
  });

  it('AC3: reads each held issue once and stops its session when the live issue remains held', async () => {
    const issues = Array.from({ length: 5 }, (_, index) =>
      makeIssue({
        number: index + 1,
        url: `https://github.com/demo/repo/issues/${index + 1}`,
        nextActionHour: 0,
      }),
    );
    const runner = createRunnerForSessions(
      issues.map((issue, index) => ({
        name: `renamed-${index}`,
        issueUrl: issue.url,
      })),
    );
    const repository = createMockIssueRepository(issues);

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    expect(repository.get).toHaveBeenCalledTimes(5);
    expect(
      runner.runCommand.mock.calls.filter(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      ),
    ).toHaveLength(5);
  });

  it('AC4: keeps a session when a snapshot-held issue is no longer held in the live read', async () => {
    const issue = makeIssue({ nextActionHour: 0 });
    const runner = createRunnerForSessions([
      { name: 'renamed-session', issueUrl: issue.url },
    ]);
    const repository = createMockIssueRepository([issue]);
    jest
      .mocked(repository.get)
      .mockResolvedValue({ ...issue, nextActionHour: null });

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    expect(repository.get).toHaveBeenCalledTimes(1);
    expect(
      runner.runCommand.mock.calls.filter(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      ),
    ).toHaveLength(0);
  });

  it('AC5: uses complete issue URLs for renamed sessions and leaves the issue 90 and unmapped sessions untouched', async () => {
    const held = makeIssue({
      number: 9,
      url: 'https://github.com/demo/repo/issues/9',
      nextActionHour: 0,
    });
    const prefixCollision = makeIssue({
      number: 90,
      url: 'https://github.com/demo/repo/issues/90',
    });
    const runner = createRunnerForSessions([
      { name: 'renamed-nine-a', issueUrl: held.url },
      { name: 'renamed-nine-b', issueUrl: held.url },
      { name: 'renamed-ninety', issueUrl: prefixCollision.url },
      { name: 'unmapped-session' },
    ]);
    const repository = createMockIssueRepository([held, prefixCollision]);

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    const killedNames = runner.runCommand.mock.calls
      .filter(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      )
      .map(([, args]) => args[2]);
    expect(killedNames).toEqual(['=renamed-nine-a', '=renamed-nine-b']);
    expect(repository.get).toHaveBeenCalledTimes(1);
  });

  it('AC6: keeps a session mapped to both a held issue and an unheld issue', async () => {
    const held = makeIssue({
      number: 1,
      url: 'https://github.com/demo/repo/issues/1',
      nextActionHour: 0,
    });
    const unheld = makeIssue({
      number: 2,
      url: 'https://github.com/demo/repo/issues/2',
    });
    const runner = createRunnerForSessions([
      { name: 'shared-session', issueUrl: `${held.url} ${unheld.url}` },
    ]);
    const repository = createMockIssueRepository([held, unheld]);

    await cleanStaleTmuxSessions({
      project: makeProject(),
      issueRepository: repository,
      localCommandRunner: runner,
      now: NOW,
    });

    expect(
      runner.runCommand.mock.calls.filter(
        ([program, args]) => program === 'tmux' && args[0] === 'kill-session',
      ),
    ).toHaveLength(0);
  });

  it('AC10: treats a missing tmux server as zero sessions and reports listing failures', async () => {
    const missingServer = createRunnerForSessions([], {
      stdout: '',
      stderr: 'no server running on /tmp/tmux-1000/default',
      exitCode: 1,
    });
    const repository = createMockIssueRepository([]);
    await expect(
      cleanStaleTmuxSessions({
        project: makeProject(),
        issueRepository: repository,
        localCommandRunner: missingServer,
        now: NOW,
      }),
    ).resolves.toBeUndefined();

    const genuineFailure = createRunnerForSessions([], {
      stdout: '',
      stderr: 'permission denied',
      exitCode: 1,
    });
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      cleanStaleTmuxSessions({
        project: makeProject(),
        issueRepository: repository,
        localCommandRunner: genuineFailure,
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
