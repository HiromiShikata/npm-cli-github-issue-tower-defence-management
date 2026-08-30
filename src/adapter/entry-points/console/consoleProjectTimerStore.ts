import * as fs from 'fs';
import * as path from 'path';

export type ProjectTimerData = {
  startedAt: string;
  durationSeconds: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const timerFilePath = (consoleDataOutputDir: string, pjcode: string): string =>
  path.join(consoleDataOutputDir, pjcode, 'timer.json');

const parseTimerData = (raw: string): ProjectTimerData | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  if (
    typeof parsed.startedAt !== 'string' ||
    typeof parsed.durationSeconds !== 'number' ||
    parsed.durationSeconds <= 0
  ) {
    return null;
  }
  return {
    startedAt: parsed.startedAt,
    durationSeconds: parsed.durationSeconds,
  };
};

export const readProjectTimer = (
  consoleDataOutputDir: string,
  pjcode: string,
): ProjectTimerData | null => {
  const filePath = timerFilePath(consoleDataOutputDir, pjcode);
  let raw: string;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  return parseTimerData(raw);
};

export const writeProjectTimer = (
  consoleDataOutputDir: string,
  pjcode: string,
  timer: ProjectTimerData,
): void => {
  const filePath = timerFilePath(consoleDataOutputDir, pjcode);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(timer));
  fs.renameSync(tmpPath, filePath);
};

export const deleteProjectTimer = (
  consoleDataOutputDir: string,
  pjcode: string,
): void => {
  const filePath = timerFilePath(consoleDataOutputDir, pjcode);
  fs.rmSync(filePath, { force: true });
};
