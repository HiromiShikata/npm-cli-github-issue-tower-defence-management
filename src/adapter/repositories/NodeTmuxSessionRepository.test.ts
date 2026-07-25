import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { NodeTmuxSessionRepository } from './NodeTmuxSessionRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
});

describe('NodeTmuxSessionRepository', () => {
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

    it('returns an empty list when tmux exits non-zero', async () => {
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

    it('returns an empty list when tmux exits non-zero', async () => {
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

  describe('killSession', () => {
    it('kills the tmux session by name', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.killSession('no_task_session');

      expect(runner.runCommand.mock.calls[0][0]).toBe('tmux');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        'kill-session',
        '-t',
        'no_task_session',
      ]);
    });

    it('throws when tmux exits non-zero', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: "can't find session",
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(repository.killSession('missing_session')).rejects.toThrow(
        'Failed to kill tmux session "missing_session": exit code 1',
      );
    });

    it('stops the systemd user scope for the session after killing it, wrapping the stop with reset-failed', async () => {
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
      const calls = runner.runCommand.mock.calls;
      expect(calls[0]).toEqual([
        'tmux',
        ['kill-session', '-t', 'https_//github_com/owner/repo/issues/9'],
      ]);
      const systemctlCalls = calls.filter((call) => call[0] === 'systemctl');
      expect(systemctlCalls).toEqual([
        ['systemctl', ['--user', 'reset-failed', expectedScopeUnitName]],
        ['systemctl', ['--user', 'stop', expectedScopeUnitName]],
        ['systemctl', ['--user', 'reset-failed', expectedScopeUnitName]],
      ]);
    });

    it('logs an error but does not throw when stopping the systemd user scope fails', async () => {
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

      await expect(
        repository.killSession('leader_session'),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to stop systemd user scope "cl-leader-session.scope"',
        ),
      );
      errorSpy.mockRestore();
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
});
