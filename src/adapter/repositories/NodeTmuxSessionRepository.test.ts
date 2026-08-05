import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

  describe('launchBareNameLeaderSession', () => {
    it('creates a detached tmux session running cl for the bare name', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.launchBareNameLeaderSession('app');

      expect(runner.runCommand.mock.calls[0][0]).toBe('tmux');
      expect(runner.runCommand.mock.calls[0][1]).toEqual([
        'new-session',
        '-d',
        '-s',
        'app',
        'bash',
        '-lc',
        "cl 'app'; exec /bin/bash",
      ]);
    });

    it('normalizes dots and colons in the session name', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await repository.launchBareNameLeaderSession('tdpm-cli.v2');

      expect(runner.runCommand.mock.calls[0][1][3]).toBe('tdpm-cli_v2');
      expect(runner.runCommand.mock.calls[0][1][6]).toBe(
        "cl 'tdpm-cli.v2'; exec /bin/bash",
      );
    });

    it('throws when tmux fails to create the session', async () => {
      const runner = createMockRunner();
      runner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: 'duplicate session',
        exitCode: 1,
      });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.launchBareNameLeaderSession('app'),
      ).rejects.toThrow('Failed to relaunch bare-name leader session "app"');
    });
  });
});
