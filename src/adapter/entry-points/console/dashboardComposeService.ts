import * as fs from 'fs';
import * as path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import {
  CloseEventCounts,
  ComposeDashboardDisk,
  ComposeDashboardInput,
  ComposeDashboardMachineStatus,
  ComposeDashboardProject,
  ComposeDashboardUseCase,
} from '../../../domain/usecases/dashboard/ComposeDashboardUseCase';
import { toDashboardDisplayLabel } from '../../../domain/usecases/dashboard/DashboardProjectCode';
import {
  DashboardRow,
  GenerateDashboardRowUseCase,
} from '../../../domain/usecases/dashboard/GenerateDashboardRowUseCase';
import {
  SevenDayWindowAggregate,
  TokenStatus,
  TokenStatusColor,
} from '../../../domain/usecases/dashboard/GenerateTokenStatusUseCase';
import { countCloseEvents } from './consoleCloseEventStore';

export type DashboardComposeOptions = {
  dashboardDataDir: string;
  projectNames: string[];
  consoleDataOutputDir?: string | null;
  nowMs?: number;
};

const NO_CLOSE_EVENTS: CloseEventCounts = { h1: 0, h3: 0, h5: 0 };

const readCloseEventCounts = (
  consoleDataOutputDir: string | null | undefined,
  projectName: string,
  nowMs: number,
): CloseEventCounts => {
  if (consoleDataOutputDir == null) {
    return NO_CLOSE_EVENTS;
  }
  return countCloseEvents(consoleDataOutputDir, projectName, nowMs);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readJsonFile = (filePath: string): unknown => {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const parseDashboardRow = (value: unknown): DashboardRow | null => {
  if (!isRecord(value)) {
    return null;
  }
  const todo = asFiniteNumber(value.todo);
  const qc = asFiniteNumber(value.qc);
  const fail = asFiniteNumber(value.fail);
  const pr = asFiniteNumber(value.pr);
  const ws = asFiniteNumber(value.ws);
  const dep = asFiniteNumber(value.dep);
  const blocker = asFiniteNumber(value.blocker);
  if (
    todo === null ||
    qc === null ||
    fail === null ||
    pr === null ||
    ws === null ||
    dep === null ||
    blocker === null
  ) {
    return null;
  }
  return {
    todo,
    qc,
    fail,
    pr,
    ws,
    dep,
    blocker,
    humanPendingRed: asFiniteNumber(value.humanPendingRed) ?? 0,
    humanPendingYellow: asFiniteNumber(value.humanPendingYellow) ?? 0,
    humanPendingBlue: asFiniteNumber(value.humanPendingBlue) ?? 0,
  };
};

type ProjectRowData = {
  row: DashboardRow | null;
  capturedAt: string | null;
  isFallback: boolean;
};

const isIssueArray = (value: unknown): value is Issue[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'nameWithOwner' in item &&
      typeof (item as Record<string, unknown>).nameWithOwner === 'string',
  );

type TdpmCacheData = {
  lastFetchedAt: string;
  issues: Issue[];
  storyColorMap: Map<string, string>;
};

const parseTdpmCacheData = (raw: unknown): TdpmCacheData | null => {
  if (!isRecord(raw)) return null;
  const lastFetchedAt =
    typeof raw.lastFetchedAt === 'string' ? raw.lastFetchedAt : null;
  if (lastFetchedAt === null) return null;
  if (!isIssueArray(raw.issues)) return null;
  const storyColorMap = new Map<string, string>();
  if (
    isRecord(raw.project) &&
    isRecord(raw.project.story) &&
    Array.isArray(raw.project.story.stories)
  ) {
    for (const story of raw.project.story.stories) {
      if (
        isRecord(story) &&
        typeof story.name === 'string' &&
        typeof story.color === 'string'
      ) {
        storyColorMap.set(story.name, story.color);
      }
    }
  }
  return { lastFetchedAt, issues: raw.issues, storyColorMap };
};

const readProjectRowWithFreshness = (
  dashboardDataDir: string,
  projectName: string,
): ProjectRowData => {
  const raw = readJsonFile(
    path.join(dashboardDataDir, 'projects', `${projectName}.json`),
  );
  if (!isRecord(raw)) {
    return { row: null, capturedAt: null, isFallback: false };
  }
  const capturedAt =
    typeof raw.capturedAt === 'string' ? raw.capturedAt : null;
  const row = parseDashboardRow(raw);
  if (row === null) {
    return { row: null, capturedAt, isFallback: false };
  }
  const assigneeLogin =
    typeof raw.assigneeLogin === 'string' ? raw.assigneeLogin : null;
  const allIssuesCacheDir =
    typeof raw.allIssuesCacheDir === 'string' ? raw.allIssuesCacheDir : null;
  if (
    allIssuesCacheDir !== null &&
    assigneeLogin !== null &&
    capturedAt !== null
  ) {
    const cacheData = parseTdpmCacheData(
      readJsonFile(path.join(allIssuesCacheDir, 'latest.json')),
    );
    if (cacheData !== null && cacheData.lastFetchedAt > capturedAt) {
      const freshRow = new GenerateDashboardRowUseCase().run({
        issues: cacheData.issues,
        assigneeLogin,
        storyColorMap: cacheData.storyColorMap,
      });
      return { row: freshRow, capturedAt: cacheData.lastFetchedAt, isFallback: false };
    }
    return { row, capturedAt, isFallback: true };
  }
  return { row, capturedAt, isFallback: false };
};

const parseLoad = (value: unknown): [number, number, number] | null => {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const oneMinute = asFiniteNumber(value[0]);
  const fiveMinute = asFiniteNumber(value[1]);
  const fifteenMinute = asFiniteNumber(value[2]);
  if (oneMinute === null || fiveMinute === null || fifteenMinute === null) {
    return null;
  }
  return [oneMinute, fiveMinute, fifteenMinute];
};

const parseDisks = (value: unknown): ComposeDashboardDisk[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const disks: ComposeDashboardDisk[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.title !== 'string') {
      return null;
    }
    const pct = asFiniteNumber(entry.pct);
    if (pct === null) {
      return null;
    }
    disks.push({ title: entry.title, pct });
  }
  return disks;
};

const readMachineStatus = (
  dashboardDataDir: string,
): ComposeDashboardMachineStatus | null => {
  const value = readJsonFile(
    path.join(dashboardDataDir, 'machine-status.json'),
  );
  if (!isRecord(value)) {
    return null;
  }
  const cycleMinutesRaw = value.cycleMinutes;
  const cycleMinutes =
    cycleMinutesRaw === null ? null : asFiniteNumber(cycleMinutesRaw);
  return {
    memPct: asFiniteNumber(value.memPct),
    cpuPct: asFiniteNumber(value.cpuPct),
    diskPct: asFiniteNumber(value.diskPct),
    disks: parseDisks(value.disks),
    load: parseLoad(value.load),
    cycleMinutes,
  };
};

const isTokenColor = (value: unknown): value is TokenStatusColor =>
  value === 'G' || value === 'Y' || value === 'K' || value === 'R';

const asTokenColor = (value: unknown): TokenStatusColor =>
  isTokenColor(value) ? value : 'Y';

const asNullableNumber = (value: unknown): number | null =>
  value === null ? null : asFiniteNumber(value);

const asCount = (value: unknown): number => {
  const number = asFiniteNumber(value);
  return number === null ? 0 : number;
};

const parseTokenStatus = (value: unknown): TokenStatus | null => {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return null;
  }
  return {
    name: value.name,
    fiveHourUtilizationPercent: asNullableNumber(
      value.fiveHourUtilizationPercent,
    ),
    fiveHourResetSeconds: asNullableNumber(value.fiveHourResetSeconds),
    sevenDayUtilizationPercent: asNullableNumber(
      value.sevenDayUtilizationPercent,
    ),
    sevenDayResetSeconds: asNullableNumber(value.sevenDayResetSeconds),
    color: asTokenColor(value.color),
    prep: asCount(value.prep),
    hum: asCount(value.hum),
  };
};

const parseSevenDayWindowAggregate = (
  value: unknown,
): SevenDayWindowAggregate | null => {
  if (!isRecord(value)) {
    return null;
  }
  const usedPercent = asFiniteNumber(value.usedPercent);
  const includedTokenCount = asFiniteNumber(value.includedTokenCount);
  const totalTokenCount = asFiniteNumber(value.totalTokenCount);
  if (
    usedPercent === null ||
    includedTokenCount === null ||
    totalTokenCount === null
  ) {
    return null;
  }
  return { usedPercent, includedTokenCount, totalTokenCount };
};

type TokenStatusFileContent = {
  tokens: TokenStatus[];
  sevenDayWindowAggregate: SevenDayWindowAggregate | null;
};

const readTokenStatusFile = (
  dashboardDataDir: string,
): TokenStatusFileContent => {
  const value = readJsonFile(path.join(dashboardDataDir, 'token-status.json'));
  if (!isRecord(value) || !Array.isArray(value.tokens)) {
    return { tokens: [], sevenDayWindowAggregate: null };
  }
  const tokens: TokenStatus[] = [];
  for (const entry of value.tokens) {
    const token = parseTokenStatus(entry);
    if (token !== null) {
      tokens.push(token);
    }
  }
  return {
    tokens,
    sevenDayWindowAggregate: parseSevenDayWindowAggregate(
      value.sevenDayWindowAggregate,
    ),
  };
};

export const buildComposeDashboardInput = (
  options: DashboardComposeOptions,
): ComposeDashboardInput => {
  const nowMs = options.nowMs ?? Date.now();
  const projects: ComposeDashboardProject[] = options.projectNames.map(
    (projectName) => {
      const { row, capturedAt, isFallback } = readProjectRowWithFreshness(
        options.dashboardDataDir,
        projectName,
      );
      return {
        code: toDashboardDisplayLabel(projectName),
        row,
        closeEventCounts: readCloseEventCounts(
          options.consoleDataOutputDir,
          projectName,
          nowMs,
        ),
        rowCapturedAt: capturedAt,
        isFallback,
      };
    },
  );
  const tokenStatusFile = readTokenStatusFile(options.dashboardDataDir);
  return {
    projects,
    machineStatus: readMachineStatus(options.dashboardDataDir),
    tokens: tokenStatusFile.tokens,
    sevenDayWindowAggregate: tokenStatusFile.sevenDayWindowAggregate,
    nowMs,
  };
};

const isExistingFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

export const dashboardComposeFilesPresent = (
  options: DashboardComposeOptions,
): boolean => {
  if (options.projectNames.length === 0) {
    return false;
  }
  const requiredFiles = [
    path.join(options.dashboardDataDir, 'machine-status.json'),
    path.join(options.dashboardDataDir, 'token-status.json'),
    ...options.projectNames.map((projectName) =>
      path.join(options.dashboardDataDir, 'projects', `${projectName}.json`),
    ),
  ];
  return requiredFiles.every((filePath) => isExistingFile(filePath));
};

export const composeDashboardText = (
  options: DashboardComposeOptions,
): string =>
  new ComposeDashboardUseCase().run(buildComposeDashboardInput(options));
