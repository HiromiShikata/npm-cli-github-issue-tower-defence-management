export const CODEX_WORKER_COUNT_FILE_NAME = 'codex-worker-count.json';

export type CodexWorkerCountFile = {
  capturedAt: string;
  runningIssueCount: number | null;
  errorMessage: string | null;
};
