import * as fs from 'fs';
import * as path from 'path';
import { CodexRunningWorkerRepository } from '../../../domain/usecases/adapter-interfaces/CodexRunningWorkerRepository';
import {
  CODEX_WORKER_COUNT_FILE_NAME,
  CodexWorkerCountFile,
} from '../../../domain/usecases/dashboard/CodexWorkerCountFile';

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

export type WriteCodexWorkerCountParams = {
  dashboardDataDir: string | null | undefined;
  repository: CodexRunningWorkerRepository;
  now: Date;
  logError: (message: string) => void;
};

const buildCountFile = (
  params: WriteCodexWorkerCountParams,
): CodexWorkerCountFile => {
  let errorMessages: string[];
  let issueUrls: string[];
  try {
    const result = params.repository.listRunningCodexWorkerIssueUrls();
    errorMessages = result.errorMessages;
    issueUrls = result.issueUrls;
  } catch (error) {
    errorMessages = [error instanceof Error ? error.message : String(error)];
    issueUrls = [];
  }
  if (errorMessages.length > 0) {
    const errorMessage = errorMessages.join('; ');
    params.logError(`Failed to count running Codex workers: ${errorMessage}`);
    return {
      capturedAt: params.now.toISOString(),
      runningIssueCount: null,
      errorMessage,
    };
  }
  return {
    capturedAt: params.now.toISOString(),
    runningIssueCount: issueUrls.length,
    errorMessage: null,
  };
};

export const writeCodexWorkerCountStatus = (
  params: WriteCodexWorkerCountParams,
): void => {
  if (!params.dashboardDataDir) {
    return;
  }
  writeJsonAtomic(
    path.join(params.dashboardDataDir, CODEX_WORKER_COUNT_FILE_NAME),
    buildCountFile(params),
  );
};
