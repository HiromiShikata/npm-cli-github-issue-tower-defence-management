import * as fs from 'fs';
import * as path from 'path';
import { CloseEventCounts } from '../../../domain/usecases/dashboard/ComposeDashboardUseCase';

export const CLOSE_EVENTS_FILE_NAME = '.close-events.json';
const RETENTION_MS = 15 * 60 * 60 * 1000;

const H1_TAU_MS = 1 * 60 * 60 * 1000;
const H3_TAU_MS = 3 * 60 * 60 * 1000;
const H5_TAU_MS = 5 * 60 * 60 * 1000;

const closeEventsFilePath = (
  consoleDataOutputDir: string,
  pjcode: string,
): string => path.join(consoleDataOutputDir, pjcode, CLOSE_EVENTS_FILE_NAME);

const readCloseEventTimestamps = (
  consoleDataOutputDir: string,
  pjcode: string,
): number[] => {
  const filePath = closeEventsFilePath(consoleDataOutputDir, pjcode);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0,
  );
};

const writeCloseEventTimestamps = (
  consoleDataOutputDir: string,
  pjcode: string,
  timestamps: number[],
): void => {
  const filePath = closeEventsFilePath(consoleDataOutputDir, pjcode);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(timestamps));
  fs.renameSync(tmpPath, filePath);
};

export const appendCloseEvent = (
  consoleDataOutputDir: string,
  pjcode: string,
  nowMs: number,
): void => {
  const existing = readCloseEventTimestamps(consoleDataOutputDir, pjcode);
  const pruned = existing.filter((t) => nowMs - t <= RETENTION_MS);
  writeCloseEventTimestamps(consoleDataOutputDir, pjcode, [...pruned, nowMs]);
};

export const appendCloseEventCount = (
  consoleDataOutputDir: string,
  pjcode: string,
  count: number,
  nowMs: number,
): void => {
  if (count <= 0) return;
  const existing = readCloseEventTimestamps(consoleDataOutputDir, pjcode);
  const pruned = existing.filter((t) => nowMs - t <= RETENTION_MS);
  const added = Array.from({ length: count }, () => nowMs);
  writeCloseEventTimestamps(consoleDataOutputDir, pjcode, [
    ...pruned,
    ...added,
  ]);
};

export const countCloseEvents = (
  consoleDataOutputDir: string,
  pjcode: string,
  nowMs: number,
): CloseEventCounts => {
  const timestamps = readCloseEventTimestamps(consoleDataOutputDir, pjcode);
  let h1 = 0;
  let h3 = 0;
  let h5 = 0;
  for (const t of timestamps) {
    const elapsedMs = nowMs - t;
    h1 += Math.exp(-elapsedMs / H1_TAU_MS);
    h3 += Math.exp(-elapsedMs / H3_TAU_MS);
    h5 += Math.exp(-elapsedMs / H5_TAU_MS);
  }
  return {
    h1: Math.round(h1),
    h3: Math.round(h3),
    h5: Math.round(h5),
  };
};
