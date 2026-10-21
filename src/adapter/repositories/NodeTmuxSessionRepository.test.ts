import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { NodeTmuxSessionRepository } from './NodeTmuxSessionRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
  spawnInteractive: jest.fn(),
});

const repositoryMapsIssueSessions = (
  repository: object,
): repository is {
  listSessionNamesForIssueUrl: (issueUrl: string) => Promise<string[]>;
} => 'listSessionNamesForIssueUrl' in repository;

describe('NodeTmuxSessionRepository', () => {
  it.each(['names', 'activity', 'issue mapping'])(
    'returns zero %s sessions for the actual absent-socket error shape',
    async (listing) => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr:
          'error connecting to /test/tmux.sock (No such file or directory)',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);
      const result =
        listing === 'names'
          ? repository.listLiveSessionNames()
          : listing === 'activity'
            ? repository.listLiveSessionsWithActivity()
            : repositoryMapsIssueSessions(repository)
              ? repository.listSessionNamesForIssueUrl(
                  'https://github.com/demo/repo/issues/9',
                )
              : Promise.reject(new Error('Missing issue session mapping'));

      await expect(result).resolves.toEqual([]);
    },
  );

  describe('listLiveSessionNames', () => {
    it('parses tmux session names and drops blank lines', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: 'session-a\nsession-b\n\n',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listLiveSessionNames();

      expect(result).toEqual(['session-a', 'session-b']);
      expect(runner.runCommand.mock.calls[0][0]).toBe('tmux');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        'list-sessions',
        '-F',
        '#{session_name}',
      ]);
    });

    it('returns no sessions when the tmux server is absent', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'no server running',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listLiveSessionNames();

      expect(result).toEqual([]);
    });
  });

  describe('listLiveSessionsWithActivity', () => {
    it('parses session names and activity epoch seconds and drops blank lines', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout:
          'https_//github_com/owner/repo/issues/9 1700000000\nno_task_session 1699000000\n\n',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listLiveSessionsWithActivity();

      expect(result).toEqual([
        {
          sessionName: 'https_//github_com/owner/repo/issues/9',
          activityEpochSeconds: 1700000000,
        },
        {
          sessionName: 'no_task_session',
          activityEpochSeconds: 1699000000,
        },
      ]);
      expect(runner.runCommand.mock.calls[0][0]).toBe('tmux');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        'list-sessions',
        '-F',
        '#{session_name} #{session_activity}',
      ]);
    });

    it('returns no sessions when the tmux server is absent', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'no server running',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listLiveSessionsWithActivity();

      expect(result).toEqual([]);
    });
  });

  describe('listRunningWorkerScopeUnitNames', () => {
    it('parses aw-*.scope unit names from systemctl list-units output', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout:
          'aw-owner-repo-1-100.scope loaded active running Aw worker\naw-owner-repo-2-200.scope loaded active running Aw worker\n\n',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listRunningWorkerScopeUnitNames();

      expect(result).toEqual([
        'aw-owner-repo-1-100.scope',
        'aw-owner-repo-2-200.scope',
      ]);
      expect(runner.runCommand.mock.calls[0][0]).toBe('systemctl');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        '--user',
        'list-units',
        '--type=scope',
        '--no-legend',
        '--plain',
        'aw-*.scope',
      ]);
    });

    it('returns an empty list when systemctl exits non-zero', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'Failed to list units: no such unit type',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listRunningWorkerScopeUnitNames();

      expect(result).toEqual([]);
    });

    it('drops blank lines and any unit not matching the aw-*.scope shape', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout:
          'aw-owner-repo-1-100.scope loaded active running Aw worker\n\ncl-some-session.scope loaded active running Cl session\n',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listRunningWorkerScopeUnitNames();

      expect(result).toEqual(['aw-owner-repo-1-100.scope']);
    });
  });

  describe('stopWorkerScopeUnit', () => {
    it('stops the given scope unit by name, wrapping the stop with reset-failed', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.stopWorkerScopeUnit('aw-owner-repo-1-100.scope');

      expect(runner.runCommand.mock.calls).toEqual([
        ['systemctl', ['--user', 'reset-failed', 'aw-owner-repo-1-100.scope']],
        ['systemctl', ['--user', 'stop', 'aw-owner-repo-1-100.scope']],
        ['systemctl', ['--user', 'reset-failed', 'aw-owner-repo-1-100.scope']],
      ]);
    });

    it('propagates a scope stop failure', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockImplementation(async (program: string) => {
        if (program === 'systemctl') {
          return {
            stdout: '',
            stderr:
              'Failed to stop aw-owner-repo-1-100.scope: Unit not loaded.',
            exitCode: 5,
          };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.stopWorkerScopeUnit('aw-owner-repo-1-100.scope'),
      ).rejects.toThrow('Failed to stop');

      errorSpy.mockRestore();
    });
  });

  describe('launchDetachedSession', () => {
    it('rejects a failed tmux launch with the original error instead of reporting success', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'new-session permission denied',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.launchDetachedSession(
          'held-session',
          'cl',
          'https://github.com/demo/repo/issues/9',
        ),
      ).rejects.toThrow('new-session permission denied');
      expect(runner.runCommand.mock.calls).toHaveLength(1);
      expect(runner.runCommand.mock.calls[0]?.slice(0, 2)).toEqual([
        'tmux',
        [
          'new-session',
          '-A',
          '-d',
          '-s',
          'held-session',
          'sh',
          '-lc',
          'exec "$1" "$2"',
          'sh',
          'cl',
          'https://github.com/demo/repo/issues/9',
        ],
      ]);
    });
  });

  describe('killSession', () => {
    it('kills the tmux session by exact name', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.killSession('no_task_session');

      const tmuxCall = runner.runCommand.mock.calls.find(
        (call) => call[0] === 'tmux',
      );
      expect(tmuxCall).toEqual([
        'tmux',
        ['kill-session', '-t', '=no_task_session'],
      ]);
    });

    it('throws when tmux exits non-zero', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockImplementation(async (program: string) => {
        if (program === 'tmux') {
          return { stdout: '', stderr: "can't find session", exitCode: 1 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(repository.killSession('missing_session')).rejects.toThrow(
        'Failed to kill tmux session "missing_session": exit code 1',
      );
    });

    it('stops the systemd user scope for the session before killing it, wrapping the stop with reset-failed', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.killSession('https_//github_com/owner/repo/issues/9');

      const expectedScopeUnitName =
        'cl-https---github-com-owner-repo-issues-9.scope';
      expect(runner.runCommand.mock.calls).toEqual([
        ['systemctl', ['--user', 'reset-failed', expectedScopeUnitName]],
        ['systemctl', ['--user', 'stop', expectedScopeUnitName]],
        ['systemctl', ['--user', 'reset-failed', expectedScopeUnitName]],
        [
          'tmux',
          ['kill-session', '-t', '=https_//github_com/owner/repo/issues/9'],
        ],
      ]);
    });

    it('propagates a scope stop failure before killing the tmux session', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockImplementation(async (program: string) => {
        if (program === 'systemctl') {
          return {
            stdout: '',
            stderr: 'Failed to stop cl-leader-session.scope: Unit not loaded.',
            exitCode: 5,
          };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(repository.killSession('leader_session')).rejects.toThrow(
        'Failed to stop',
      );

      errorSpy.mockRestore();
    });
  });

  describe('killOwnSession', () => {
    let procDirectory: string;

    beforeEach(() => {
      procDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'node-tmux-session-repository-proc-'),
      );
    });

    afterEach(() => {
      fs.rmSync(procDirectory, { recursive: true, force: true });
    });

    const writeCgroupContent = (content: string): void => {
      const selfDirectory = path.join(procDirectory, 'self');
      fs.mkdirSync(selfDirectory, { recursive: true });
      fs.writeFileSync(path.join(selfDirectory, 'cgroup'), content);
    };

    it('stops only the current session scope derived from /proc/self/cgroup, without calling tmux', async () => {
      writeCgroupContent(
        '0::/user.slice/user-1000.slice/user@1000.service/app.slice/cl-leader-session.scope\n',
      );
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner, procDirectory);

      await repository.killOwnSession();

      expect(runner.runCommand.mock.calls).toEqual([
        ['systemctl', ['--user', 'reset-failed', 'cl-leader-session.scope']],
        ['systemctl', ['--user', 'stop', 'cl-leader-session.scope']],
        ['systemctl', ['--user', 'reset-failed', 'cl-leader-session.scope']],
      ]);
      expect(
        runner.runCommand.mock.calls.some((call) => call[0] === 'tmux'),
      ).toBe(false);
    });

    it('throws when no cl-*.scope unit can be found in /proc/self/cgroup', async () => {
      writeCgroupContent(
        '0::/user.slice/user-1000.slice/user@1000.service/app.slice/vte-spawn-abc.scope\n',
      );
      const runner = createMockRunner();
      const repository = new NodeTmuxSessionRepository(runner, procDirectory);

      await expect(repository.killOwnSession()).rejects.toThrow(
        'Failed to determine the current cl-*.scope systemd user unit from /proc/self/cgroup',
      );
      expect(runner.runCommand.mock.calls).toHaveLength(0);
    });
  });

  describe('listInteractiveProcessCommandLines', () => {
    it('parses process command lines from ps output', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout:
          'claude --name https://github.com/demo/repo/issues/1\n/usr/bin/tmux\n',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      const result = await repository.listInteractiveProcessCommandLines();

      expect(result).toEqual([
        'claude --name https://github.com/demo/repo/issues/1',
        '/usr/bin/tmux',
      ]);
      expect(runner.runCommand.mock.calls[0][0]).toBe('ps');
      expect(runner.runCommand.mock.calls[0][1]).toEqual(['-eo', 'args=']);
    });
  });

  describe('launchDetachedSession', () => {
    it('attaches-or-creates a detached tmux session running the launcher command with the issue url', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.launchDetachedSession(
        'https_//github_com/demo/repo/issues/1',
        'cl',
        'https://github.com/demo/repo/issues/1',
      );

      expect(runner.runCommand.mock.calls[0][0]).toBe('tmux');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
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
  });

  describe('sendKeys', () => {
    it('wraps the message in bracketed paste markers and submits it with exactly one Enter', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner, '/proc', 0);

      await repository.sendKeys('session-a', 'checkpoint now');

      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        'send-keys',
        '-t',
        'session-a',
        '-l',
        '\x1b[200~checkpoint now\x1b[201~',
      ]);
      expect(runner.runCommand.mock.calls[1][1]).toEqual([
        'send-keys',
        '-t',
        'session-a',
        'Enter',
      ]);
      expect(runner.runCommand.mock.calls).toHaveLength(2);
    });

    it('never inspects the composer and never sends a second Enter', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '> checkpoint now',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner, '/proc', 0);

      await repository.sendKeys('session-a', 'checkpoint now');

      const commands = runner.runCommand.mock.calls.map((call) => call[1]);
      expect(
        commands.filter((args) => args.includes('capture-pane')),
      ).toHaveLength(0);
      expect(commands.filter((args) => args.includes('Enter'))).toHaveLength(1);
    });

    it('throws when sending the literal text fails', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'no session',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner, '/proc', 0);

      await expect(repository.sendKeys('session-a', 'text')).rejects.toThrow(
        'Failed to send keys to tmux session "session-a"',
      );
    });
  });

  describe('attachOrCreateInteractiveSession', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/9';

    it('attaches to the registered session when the registry returns a live session name', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: 'wq7x3mk\n', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[0]).toEqual([
        'bash',
        ['/path/to/cl-scope-lib.sh', 'registry-get-session', issueUrl],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['has-session', '-t', '=wq7x3mk'],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['attach-session', '-t', '=wq7x3mk']],
      ]);
    });

    it('creates a new session when no session is registered and no live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[1]).toEqual([
        'ps',
        ['-eo', 'pid=,ppid=,args='],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['new-session', '-A', '-s', issueUrl, 'cl', issueUrl]],
      ]);
    });

    it('creates a new session when the registered session is no longer alive and no live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: 'wq7x3mk\n', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: "can't find session",
          exitCode: 1,
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['has-session', '-t', '=wq7x3mk'],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['new-session', '-A', '-s', issueUrl, 'cl', issueUrl]],
      ]);
    });

    it('creates a new session when the registry lookup fails and no live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'registry error',
          exitCode: 1,
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[1]).toEqual([
        'ps',
        ['-eo', 'pid=,ppid=,args='],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['new-session', '-A', '-s', issueUrl, 'cl', issueUrl]],
      ]);
    });

    it('creates a new session without calling the registry when no scope lib path is provided and no live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(issueUrl, null);

      expect(runner.runCommand.mock.calls).toHaveLength(1);
      expect(runner.runCommand.mock.calls[0]).toEqual([
        'ps',
        ['-eo', 'pid=,ppid=,args='],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['new-session', '-A', '-s', issueUrl, 'cl', issueUrl]],
      ]);
    });

    it('attaches to an existing session found via process tree when no scope lib path is provided but a live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({
          stdout: '1100 1050 /usr/bin/bash\n' + `1234 1100 cl ${issueUrl}\n`,
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '1100 abc123def456ab12\n',
          stderr: '',
          exitCode: 0,
        });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(issueUrl, null);

      expect(runner.runCommand.mock.calls).toHaveLength(2);
      expect(runner.runCommand.mock.calls[0]).toEqual([
        'ps',
        ['-eo', 'pid=,ppid=,args='],
      ]);
      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['list-panes', '-a', '-F', '#{pane_pid} #{session_name}'],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['attach-session', '-t', '=abc123def456ab12']],
      ]);
    });

    it('attaches to an existing session found via process tree when the registry is empty but a live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout:
            '1050 1000 /usr/bin/tmux\n' +
            '1100 1050 /usr/bin/bash\n' +
            `1234 1100 cl ${issueUrl}\n`,
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '1100 abc123def456ab12\n5678 other_session\n',
          stderr: '',
          exitCode: 0,
        });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[1]).toEqual([
        'ps',
        ['-eo', 'pid=,ppid=,args='],
      ]);
      expect(runner.runCommand.mock.calls[2]).toEqual([
        'tmux',
        ['list-panes', '-a', '-F', '#{pane_pid} #{session_name}'],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['attach-session', '-t', '=abc123def456ab12']],
      ]);
    });

    it('attaches to an existing session found via process tree when the registered session is stale but a live process exists', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: 'wq7x3mk\n', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: "can't find session",
          exitCode: 1,
        })
        .mockResolvedValueOnce({
          stdout: '1100 1050 /usr/bin/bash\n' + `1234 1100 cl ${issueUrl}\n`,
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '1100 abc123def456ab12\n',
          stderr: '',
          exitCode: 0,
        });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['attach-session', '-t', '=abc123def456ab12']],
      ]);
    });

    it('propagates process listing failure without fallback launch', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ stdout: '', stderr: 'ps error', exitCode: 1 });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.attachOrCreateInteractiveSession(
          issueUrl,
          '/path/to/cl-scope-lib.sh',
        ),
      ).rejects.toThrow('ps error');

      expect(runner.spawnInteractive.mock.calls).toEqual([]);
    });

    it('propagates genuine pane failure without fallback launch', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: `1234 1100 cl ${issueUrl}\n`,
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'pane permission denied',
          exitCode: 1,
        });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.attachOrCreateInteractiveSession(
          issueUrl,
          '/path/to/cl-scope-lib.sh',
        ),
      ).rejects.toThrow('pane permission denied');

      expect(runner.spawnInteractive.mock.calls).toEqual([]);
    });

    it('creates a new session when no pane PID in the list-panes output matches the process ancestor chain', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: `1234 1100 cl ${issueUrl}\n`,
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '9999 unrelated_session\n',
          stderr: '',
          exitCode: 0,
        });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['new-session', '-A', '-s', issueUrl, 'cl', issueUrl]],
      ]);
    });

    it('trims whitespace from the registered session name before checking tmux', async () => {
      const runner = createMockRunner();
      runner.runCommand
        .mockResolvedValueOnce({
          stdout: '  abc123  \n',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.attachOrCreateInteractiveSession(
        issueUrl,
        '/path/to/cl-scope-lib.sh',
      );

      expect(runner.runCommand.mock.calls[1]).toEqual([
        'tmux',
        ['has-session', '-t', '=abc123'],
      ]);
      expect(runner.spawnInteractive.mock.calls).toEqual([
        ['tmux', ['attach-session', '-t', '=abc123']],
      ]);
    });
  });
  it('maps every renamed session to the exact issue URL', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'ps')
        return {
          stdout:
            '100 1 sh\n101 100 claude --name https://github.com/demo/repo/issues/9\n200 1 sh\n201 200 codex https://github.com/demo/repo/issues/9\n300 1 sh\n301 300 claude --name https://github.com/demo/repo/issues/90\n400 1 unrelated\n',
          stderr: '',
          exitCode: 0,
        };
      if (args[0] === 'list-panes')
        return {
          stdout:
            '100 renamed-first\n200 renamed-second\n300 issue-90\n400 unmapped\n',
          stderr: '',
          exitCode: 0,
        };
      return {
        stdout: 'renamed-first\nrenamed-second\nissue-90\nunmapped\n',
        stderr: '',
        exitCode: 0,
      };
    });
    const repository = new NodeTmuxSessionRepository(runner);
    if (!repositoryMapsIssueSessions(repository))
      throw new Error('Missing exact issue session mapping method');
    expect(
      await repository.listSessionNamesForIssueUrl(
        'https://github.com/demo/repo/issues/9',
      ),
    ).toEqual(['renamed-first', 'renamed-second']);
    expect(
      await repository.listSessionNamesForIssueUrl(
        'https://github.com/demo/repo/issues/90',
      ),
    ).toEqual(['issue-90']);
  });

  it('propagates genuine list and stop failures', async () => {
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => ({
      stdout: '',
      stderr: `${program} ${args[0]} permission denied`,
      exitCode: 1,
    }));
    const repository = new NodeTmuxSessionRepository(runner);
    await expect(repository.listLiveSessionNames()).rejects.toThrow(
      'permission denied',
    );
    await expect(repository.listLiveSessionsWithActivity()).rejects.toThrow(
      'permission denied',
    );
    await expect(
      repository.listInteractiveProcessCommandLines(),
    ).rejects.toThrow('permission denied');
    await expect(repository.killSession('held-session')).rejects.toThrow(
      'permission denied',
    );
  });

  it('propagates process and pane mapping failures', async () => {
    for (const failingProgram of ['ps', 'tmux']) {
      const runner = createMockRunner();
      runner.runCommand.mockImplementation(async (program, args) => {
        if (
          program === failingProgram &&
          (program === 'ps' || args[0] === 'list-panes')
        )
          return {
            stdout: '',
            stderr: 'mapping permission denied',
            exitCode: 1,
          };
        return {
          stdout:
            program === 'ps'
              ? '100 1 claude https://github.com/demo/repo/issues/9\n'
              : 'held-session\n',
          stderr: '',
          exitCode: 0,
        };
      });
      const repository = new NodeTmuxSessionRepository(runner);
      if (!repositoryMapsIssueSessions(repository))
        throw new Error('Missing exact issue session mapping method');
      await expect(
        repository.listSessionNamesForIssueUrl(
          'https://github.com/demo/repo/issues/9',
        ),
      ).rejects.toThrow('mapping permission denied');
    }
  });
});
