const mockExecFileAsync = jest.fn();
const mockSpawnSync = jest.fn();

jest.mock('child_process', () => ({
  execFile: jest.fn(),
  spawnSync: jest.fn((...args: unknown[]) => {
    mockSpawnSync(...args);
  }),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecFileAsync),
}));

import { NodeLocalCommandRunner } from './NodeLocalCommandRunner';

describe('NodeLocalCommandRunner', () => {
  let runner: NodeLocalCommandRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new NodeLocalCommandRunner();
  });

  describe('runCommand', () => {
    it('should execute command successfully', async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: 'command output',
        stderr: '',
      });

      const result = await runner.runCommand('echo', ['"test"']);

      expect(result).toEqual({
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
      });
      expect(mockExecFileAsync).toHaveBeenCalledWith('echo', ['"test"'], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 256,
      });
    });

    it('should handle command errors with exit code', async () => {
      const error = Object.assign(new Error('Command failed'), {
        code: 2,
        stdout: 'partial output',
        stderr: 'error message',
      });
      mockExecFileAsync.mockRejectedValue(error);

      const result = await runner.runCommand('invalid-command', []);

      expect(result).toEqual({
        stdout: 'partial output',
        stderr: 'error message',
        exitCode: 2,
      });
    });

    it('should default to exit code 1 when code is not a number', async () => {
      const error = Object.assign(new Error('Command failed'), {
        code: 'ENOENT',
        stdout: '',
        stderr: 'command not found',
      });
      mockExecFileAsync.mockRejectedValue(error);

      const result = await runner.runCommand('nonexistent', []);

      expect(result).toEqual({
        stdout: '',
        stderr: 'command not found',
        exitCode: 1,
      });
    });

    it('should report the reason when the command did not exit with a numeric status', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const error = Object.assign(new Error('Command failed'), {
        code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
        stdout: 'truncated output',
        stderr: '',
      });
      mockExecFileAsync.mockRejectedValue(error);

      await runner.runCommand('osv-scanner', []);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'osv-scanner did not exit with a numeric status: ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      );
      consoleErrorSpy.mockRestore();
    });

    it('should throw error if error format is unexpected', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('Unexpected error'));

      await expect(runner.runCommand('command', [])).rejects.toThrow(
        'Unexpected error',
      );
    });
  });

  describe('spawnInteractive', () => {
    it('calls spawnSync with stdio inherit', () => {
      runner.spawnInteractive('tmux', ['attach-session', '-t', '=wq7x3mk']);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'tmux',
        ['attach-session', '-t', '=wq7x3mk'],
        { stdio: 'inherit' },
      );
    });
  });
});
