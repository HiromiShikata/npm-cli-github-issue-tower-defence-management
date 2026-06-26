import * as fs from 'fs';
import * as path from 'path';
import {
  ComposeDashboardInput,
  ComposeDashboardMachineStatus,
  ComposeDashboardProject,
  ComposeDashboardUseCase,
} from '../../../domain/usecases/dashboard/ComposeDashboardUseCase';
import { DashboardRow } from '../../../domain/usecases/dashboard/GenerateDashboardRowUseCase';
import {
  TokenStatus,
  TokenStatusColor,
} from '../../../domain/usecases/dashboard/GenerateTokenStatusUseCase';

export type DashboardComposeOptions = {
  dashboardDataDir: string;
  projectCodes: string[];
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
  const unread = asFiniteNumber(value.unread);
  const todo = asFiniteNumber(value.todo);
  const qc = asFiniteNumber(value.qc);
  const fail = asFiniteNumber(value.fail);
  const pr = asFiniteNumber(value.pr);
  const ws = asFiniteNumber(value.ws);
  const dep = asFiniteNumber(value.dep);
  const blocker = asFiniteNumber(value.blocker);
  if (
    unread === null ||
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
  return { unread, todo, qc, fail, pr, ws, dep, blocker };
};

const readProjectRow = (
  dashboardDataDir: string,
  code: string,
): DashboardRow | null =>
  parseDashboardRow(
    readJsonFile(path.join(dashboardDataDir, 'projects', `${code}.json`)),
  );

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
    load: parseLoad(value.load),
    cycleMinutes,
  };
};

const isTokenColor = (value: unknown): value is TokenStatusColor =>
  value === 'G' || value === 'Y' || value === 'K';

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

const readTokenStatuses = (dashboardDataDir: string): TokenStatus[] => {
  const value = readJsonFile(path.join(dashboardDataDir, 'token-status.json'));
  if (!isRecord(value) || !Array.isArray(value.tokens)) {
    return [];
  }
  const tokens: TokenStatus[] = [];
  for (const entry of value.tokens) {
    const token = parseTokenStatus(entry);
    if (token !== null) {
      tokens.push(token);
    }
  }
  return tokens;
};

export const buildComposeDashboardInput = (
  options: DashboardComposeOptions,
): ComposeDashboardInput => {
  const projects: ComposeDashboardProject[] = options.projectCodes.map(
    (code) => ({
      code,
      row: readProjectRow(options.dashboardDataDir, code),
    }),
  );
  return {
    projects,
    machineStatus: readMachineStatus(options.dashboardDataDir),
    tokens: readTokenStatuses(options.dashboardDataDir),
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
  if (options.projectCodes.length === 0) {
    return false;
  }
  const requiredFiles = [
    path.join(options.dashboardDataDir, 'machine-status.json'),
    path.join(options.dashboardDataDir, 'token-status.json'),
    ...options.projectCodes.map((code) =>
      path.join(options.dashboardDataDir, 'projects', `${code}.json`),
    ),
  ];
  return requiredFiles.every((filePath) => isExistingFile(filePath));
};

export const composeDashboardText = (
  options: DashboardComposeOptions,
): string =>
  new ComposeDashboardUseCase().run(buildComposeDashboardInput(options));
