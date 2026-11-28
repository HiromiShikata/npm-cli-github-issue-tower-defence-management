import * as fs from 'fs';
import * as path from 'path';

export const ACTION_RESULTS_FILE_NAME = '.console-action-results.json';
export const ACTION_RESULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const ACTION_RESULT_LIMIT = 1000;

export type ConsoleActionRecord = {
  recordedAtMs: number;
  statusCode: number;
  body: Record<string, unknown>;
};

const actionResultsFilePath = (consoleDataOutputDir: string): string =>
  path.join(consoleDataOutputDir, ACTION_RESULTS_FILE_NAME);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isConsoleActionRecord = (value: unknown): value is ConsoleActionRecord =>
  isRecord(value) &&
  typeof value.recordedAtMs === 'number' &&
  Number.isFinite(value.recordedAtMs) &&
  typeof value.statusCode === 'number' &&
  Number.isInteger(value.statusCode) &&
  isRecord(value.body);

const isPendingIntent = (record: ConsoleActionRecord): boolean =>
  !('issueUrl' in record.body) &&
  (record.body.issueCreationPending === true ||
    record.body.issueCreated === false);

const readActionResultsFile = (consoleDataOutputDir: string): unknown => {
  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(actionResultsFilePath(consoleDataOutputDir), 'utf-8'),
    );
    return parsed;
  } catch (error) {
    const errorCode =
      error !== null && typeof error === 'object' && 'code' in error
        ? error.code
        : null;
    if (errorCode === 'ENOENT') return null;
    console.error(
      '[consoleActionResultStore] failed to read action results',
      error,
    );
    return null;
  }
};

export const readConsoleActionRecords = (
  consoleDataOutputDir: string,
  nowMs: number,
): Record<string, ConsoleActionRecord> => {
  const parsed = readActionResultsFile(consoleDataOutputDir);
  if (parsed === null) return {};
  if (!isRecord(parsed)) {
    console.error(
      '[consoleActionResultStore] action results must be an object',
    );
    return {};
  }
  const records: Record<string, ConsoleActionRecord> = {};
  for (const [actionId, value] of Object.entries(parsed)) {
    if (!isConsoleActionRecord(value)) {
      console.error(
        '[consoleActionResultStore] action result has an invalid shape',
        { actionId },
      );
      continue;
    }
    if (
      isPendingIntent(value) ||
      nowMs - value.recordedAtMs <= ACTION_RESULT_RETENTION_MS
    ) {
      records[actionId] = value;
    }
  }
  return records;
};

export const writeConsoleActionRecord = (
  consoleDataOutputDir: string,
  actionId: string,
  record: ConsoleActionRecord,
  nowMs: number,
): boolean => {
  const records = readConsoleActionRecords(consoleDataOutputDir, nowMs);
  records[actionId] = record;
  const entries = Object.entries(records)
    .filter(
      ([, value]) =>
        isPendingIntent(value) ||
        nowMs - value.recordedAtMs <= ACTION_RESULT_RETENTION_MS,
    )
    .sort(([, first], [, second]) => {
      const firstPending = isPendingIntent(first);
      const secondPending = isPendingIntent(second);
      if (firstPending !== secondPending) return firstPending ? 1 : -1;
      return first.recordedAtMs - second.recordedAtMs;
    })
    .slice(-ACTION_RESULT_LIMIT);
  const retained = Object.fromEntries(entries);
  const filePath = actionResultsFilePath(consoleDataOutputDir);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryFilePath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryFilePath, JSON.stringify(retained));
    fs.renameSync(temporaryFilePath, filePath);
    return true;
  } catch (error) {
    console.error(
      '[consoleActionResultStore] failed to write action results',
      error,
    );
    return false;
  }
};

export const deleteConsoleActionRecord = (
  consoleDataOutputDir: string,
  actionId: string,
  nowMs: number,
): boolean => {
  const records = readConsoleActionRecords(consoleDataOutputDir, nowMs);
  if (!(actionId in records)) return true;
  delete records[actionId];
  const filePath = actionResultsFilePath(consoleDataOutputDir);
  try {
    const temporaryFilePath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryFilePath, JSON.stringify(records));
    fs.renameSync(temporaryFilePath, filePath);
    return true;
  } catch (error) {
    console.error(
      '[consoleActionResultStore] failed to delete action result',
      error,
    );
    return false;
  }
};
