import * as fs from 'fs';
import * as path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import {
  CODEX_SEVEN_DAY_WINDOW_DIR_NAME,
  CodexSevenDayWindowState,
  CodexSevenDayWindowStatus,
} from '../../../domain/usecases/dashboard/CodexSevenDayWindowUseCase';
import {
  CODEX_WORKER_COUNT_FILE_NAME,
  CodexWorkerCountFile,
} from '../../../domain/usecases/dashboard/CodexWorkerCountFile';
import {
  CloseEventCounts,
  ComposeDashboardDisk,
  ComposeDashboardInput,
  ComposeDashboardMachineStatus,
  ComposeDashboardProject,
} from '../../../domain/usecases/dashboard/ComposeDashboardUseCase';
import { assignDashboardDisplayLabels } from '../../../domain/usecases/dashboard/DashboardProjectCode';
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
  const consoleTodoByHumanCount = asFiniteNumber(value.consoleTodoByHumanCount);
  const consoleAwaitingOwnerCount = asFiniteNumber(
    value.consoleAwaitingOwnerCount,
  );
  if (
    todo === null ||
    qc === null ||
    fail === null ||
    pr === null ||
    ws === null ||
    dep === null ||
    blocker === null ||
    consoleTodoByHumanCount === null ||
    consoleAwaitingOwnerCount === null
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
    consoleTodoByHumanCount,
    consoleAwaitingOwnerCount,
  };
};

export type ProjectRowData = {
  row: DashboardRow | null;
  capturedAt: string | null;
};

const isIssueArray = (value: unknown): value is Issue[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) => isRecord(item) && typeof item.nameWithOwner === 'string',
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
        typeof story.id === 'string' &&
        typeof story.color === 'string'
      ) {
        storyColorMap.set(story.id, story.color);
      }
    }
  }
  return { lastFetchedAt, issues: raw.issues, storyColorMap };
};

export const readProjectRowWithFreshness = (
  dashboardDataDir: string,
  projectName: string,
): ProjectRowData => {
  const raw = readJsonFile(
    path.join(dashboardDataDir, 'projects', `${projectName}.json`),
  );
  if (!isRecord(raw)) {
    return { row: null, capturedAt: null };
  }
  const capturedAt = typeof raw.capturedAt === 'string' ? raw.capturedAt : null;
  const row = parseDashboardRow(raw);
  if (row === null) {
    return { row: null, capturedAt };
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
      return {
        row: freshRow,
        capturedAt: cacheData.lastFetchedAt,
      };
    }
    return { row, capturedAt };
  }
  return { row, capturedAt: null };
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

const CODEX_SEVEN_DAY_WINDOW_STATES: CodexSevenDayWindowState[] = [
  'observed',
  'no-data',
  'error',
];

const isCodexSevenDayWindowState = (
  value: unknown,
): value is CodexSevenDayWindowState =>
  CODEX_SEVEN_DAY_WINDOW_STATES.some((state) => state === value);

const parseCodexSevenDayWindowStatus = (
  value: unknown,
): CodexSevenDayWindowStatus | null => {
  if (!isRecord(value) || typeof value.codexHome !== 'string') {
    return null;
  }
  if (!isCodexSevenDayWindowState(value.state)) {
    return null;
  }
  const usedPercent = asNullableNumber(value.usedPercent);
  const resetsAtEpochSeconds = asNullableNumber(value.resetsAtEpochSeconds);
  if (
    value.state === 'observed' &&
    (usedPercent === null || resetsAtEpochSeconds === null)
  ) {
    return null;
  }
  return {
    codexHome: value.codexHome,
    state: value.state,
    usedPercent,
    resetsAtEpochSeconds,
    capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : null,
    errorMessage:
      typeof value.errorMessage === 'string' ? value.errorMessage : null,
  };
};

type CodexSevenDayWindowFileContent = {
  capturedAt: string;
  windows: CodexSevenDayWindowStatus[];
};

const isNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT';

const readCodexSevenDayWindowFiles = (
  dashboardDataDir: string,
): CodexSevenDayWindowFileContent[] => {
  const directory = path.join(
    dashboardDataDir,
    CODEX_SEVEN_DAY_WINDOW_DIR_NAME,
  );
  let fileNames: string[];
  try {
    fileNames = fs.readdirSync(directory);
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error(
        `Failed to list Codex seven day window files in ${directory}:`,
        error,
      );
    }
    return [];
  }
  const files: CodexSevenDayWindowFileContent[] = [];
  for (const fileName of fileNames) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const filePath = path.join(directory, fileName);
    const value = readJsonFile(filePath);
    if (
      !isRecord(value) ||
      typeof value.capturedAt !== 'string' ||
      !Array.isArray(value.windows)
    ) {
      console.error(
        `Ignored unreadable Codex seven day window file ${filePath}`,
      );
      continue;
    }
    const windows: CodexSevenDayWindowStatus[] = [];
    for (const entry of value.windows) {
      const window = parseCodexSevenDayWindowStatus(entry);
      if (window === null) {
        console.error(
          `Ignored malformed Codex seven day window entry in ${filePath}`,
        );
      } else {
        windows.push(window);
      }
    }
    files.push({ capturedAt: value.capturedAt, windows });
  }
  return files;
};

const compareText = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const mergeCodexSevenDayWindows = (
  files: CodexSevenDayWindowFileContent[],
): CodexSevenDayWindowStatus[] => {
  const newestFirst = [...files].sort((left, right) =>
    compareText(right.capturedAt, left.capturedAt),
  );
  const windowByHome = new Map<string, CodexSevenDayWindowStatus>();
  for (const file of newestFirst) {
    for (const window of file.windows) {
      if (!windowByHome.has(window.codexHome)) {
        windowByHome.set(window.codexHome, window);
      }
    }
  }
  return [...windowByHome.values()].sort((left, right) =>
    compareText(left.codexHome, right.codexHome),
  );
};

const isCodexWorkerCountFile = (
  value: unknown,
): value is CodexWorkerCountFile =>
  isRecord(value) &&
  typeof value.capturedAt === 'string' &&
  (value.runningIssueCount === null ||
    (typeof value.runningIssueCount === 'number' &&
      Number.isInteger(value.runningIssueCount) &&
      value.runningIssueCount >= 0)) &&
  (value.errorMessage === null || typeof value.errorMessage === 'string');

export const readCodexRunningWorkerCount = (
  dashboardDataDir: string,
): number | null => {
  const filePath = path.join(dashboardDataDir, CODEX_WORKER_COUNT_FILE_NAME);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.error(
        `Failed to read Codex worker count file ${filePath}:`,
        error,
      );
    }
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      `Ignored malformed Codex worker count file ${filePath}:`,
      error,
    );
    return null;
  }
  if (!isCodexWorkerCountFile(parsed)) {
    console.error(
      `Ignored Codex worker count file with unexpected shape ${filePath}`,
    );
    return null;
  }
  if (parsed.errorMessage !== null) {
    console.error(
      `Codex worker count is unavailable: ${parsed.errorMessage} (${filePath})`,
    );
    return null;
  }
  return parsed.runningIssueCount;
};

export const buildComposeDashboardInput = (
  options: DashboardComposeOptions,
): ComposeDashboardInput => {
  const nowMs = options.nowMs ?? Date.now();
  const projects: ComposeDashboardProject[] = Array.from(
    assignDashboardDisplayLabels(options.projectNames),
    ([projectName, displayLabel]) => {
      const { row, capturedAt } = readProjectRowWithFreshness(
        options.dashboardDataDir,
        projectName,
      );
      return {
        code: displayLabel,
        row,
        closeEventCounts: readCloseEventCounts(
          options.consoleDataOutputDir,
          projectName,
          nowMs,
        ),
        rowCapturedAt: capturedAt,
      };
    },
  );
  const tokenStatusFile = readTokenStatusFile(options.dashboardDataDir);
  const codexSevenDayWindowFiles = readCodexSevenDayWindowFiles(
    options.dashboardDataDir,
  );
  return {
    projects,
    machineStatus: readMachineStatus(options.dashboardDataDir),
    tokens: tokenStatusFile.tokens,
    sevenDayWindowAggregate: tokenStatusFile.sevenDayWindowAggregate,
    codexSevenDayWindows:
      codexSevenDayWindowFiles.length === 0
        ? null
        : mergeCodexSevenDayWindows(codexSevenDayWindowFiles),
    codexRunningWorkerCount: readCodexRunningWorkerCount(
      options.dashboardDataDir,
    ),
    nowMs,
  };
};
