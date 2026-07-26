import { NodeProcessSignalRepository } from './NodeProcessSignalRepository';

const errnoError = (message: string, code: string): NodeJS.ErrnoException => {
  const error: NodeJS.ErrnoException = new Error(message);
  error.code = code;
  return error;
};

describe('NodeProcessSignalRepository', () => {
  let repository: NodeProcessSignalRepository;
  let killSpy: jest.SpyInstance;

  beforeEach(() => {
    repository = new NodeProcessSignalRepository();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isProcessAlive', () => {
    it('returns true for the current process', () => {
      expect(repository.isProcessAlive(process.pid)).toBe(true);
    });

    it('returns false for a pid that does not exist', () => {
      killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw errnoError('no such process', 'ESRCH');
      });

      expect(repository.isProcessAlive(999999)).toBe(false);
      expect(killSpy).toHaveBeenCalledWith(999999, 0);
    });

    it('returns true when signalling is not permitted', () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw errnoError('operation not permitted', 'EPERM');
      });

      expect(repository.isProcessAlive(1)).toBe(true);
    });
  });

  describe('terminateProcess', () => {
    it('sends SIGTERM to the pid', () => {
      killSpy = jest.spyOn(process, 'kill').mockReturnValue(true);

      repository.terminateProcess(4242);

      expect(killSpy).toHaveBeenCalledWith(4242, 'SIGTERM');
    });

    it('does not throw or log when the process already exited', () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw errnoError('no such process', 'ESRCH');
      });

      expect(() => repository.terminateProcess(4242)).not.toThrow();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('killProcess', () => {
    it('sends SIGKILL to the pid', () => {
      killSpy = jest.spyOn(process, 'kill').mockReturnValue(true);

      repository.killProcess(4242);

      expect(killSpy).toHaveBeenCalledWith(4242, 'SIGKILL');
    });

    it('logs an unexpected signalling error without throwing', () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw errnoError('operation not permitted', 'EPERM');
      });

      expect(() => repository.killProcess(4242)).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
