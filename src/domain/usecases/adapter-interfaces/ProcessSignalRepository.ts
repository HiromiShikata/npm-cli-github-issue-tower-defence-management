export interface ProcessSignalRepository {
  isProcessAlive: (pid: number) => boolean;
  terminateProcess: (pid: number) => void;
  killProcess: (pid: number) => void;
}
