import { ProcessSignalRepository } from '../../domain/usecases/adapter-interfaces/ProcessSignalRepository';

const errorCode = (error: unknown): string | null => {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return null;
};

export class NodeProcessSignalRepository implements ProcessSignalRepository {
  isProcessAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return errorCode(error) === 'EPERM';
    }
  };

  terminateProcess = (pid: number): void => {
    this.signal(pid, 'SIGTERM');
  };

  killProcess = (pid: number): void => {
    this.signal(pid, 'SIGKILL');
  };

  private signal = (pid: number, signal: NodeJS.Signals): void => {
    try {
      process.kill(pid, signal);
    } catch (error) {
      if (errorCode(error) === 'ESRCH') {
        return;
      }
      console.error(
        `Failed to send ${signal} to pid ${pid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}
