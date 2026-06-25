import { Issue } from '../../../domain/entities/Issue';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { reconcileInTmuxByHumanSessions } from './inTmuxByHumanSessionReconciler';

const ASSIGNEE = 'owner-login';
const NOW = new Date('2026-06-25T12:00:00.000Z');

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: 'In Tmux by human',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [ASSIGNEE],
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
  ...overrides,
});

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
});

describe('reconcileInTmuxByHumanSessions', () => {
  it('does nothing when no launcher command is configured', async () => {
    const runner = createMockRunner();

    await reconcileInTmuxByHumanSessions({
      inTmuxLauncherCommand: null,
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      now: NOW,
    });

    expect(runner.runCommand.mock.calls).toHaveLength(0);
  });

  it('launches a detached tmux session when an In Tmux by human session is missing', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      if (program === 'ps') {
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await reconcileInTmuxByHumanSessions({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      now: NOW,
    });

    const newSessionCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'new-session',
    );
    expect(newSessionCall).toBeDefined();
    expect(newSessionCall?.[1]).toEqual([
      'new-session',
      '-A',
      '-d',
      '-s',
      'https_//github_com/demo/repo/issues/1',
      'sh',
      '-lc',
      'exec "$1" "$2"',
      'sh',
      'cl',
      'https://github.com/demo/repo/issues/1',
    ]);
  });

  it('does not launch when a live session already exists', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return {
          stdout: 'https_//github_com/demo/repo/issues/1\n',
          stderr: '',
          exitCode: 0,
        };
      }
      if (program === 'ps') {
        return {
          stdout: 'claude --name https://github.com/demo/repo/issues/1\n',
          stderr: '',
          exitCode: 0,
        };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await reconcileInTmuxByHumanSessions({
      inTmuxLauncherCommand: 'cl',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue()],
      localCommandRunner: runner,
      now: NOW,
    });

    const newSessionCalls = runner.runCommand.mock.calls.filter(
      (call) => call[0] === 'tmux' && call[1][0] === 'new-session',
    );
    expect(newSessionCalls).toHaveLength(0);
  });
});
