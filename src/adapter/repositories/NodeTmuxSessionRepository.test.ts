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
