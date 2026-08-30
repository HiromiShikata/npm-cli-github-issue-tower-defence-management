import { DashboardRow } from './GenerateDashboardRowUseCase';
import {
  SevenDayWindowAggregate,
  TokenStatus,
  TokenStatusColor,
} from './GenerateTokenStatusUseCase';

export const PROJECT_ROW_WIDTH_BUDGET = 40;

export type ComposeDashboardProject = {
  code: string;
  row: DashboardRow | null;
};

export type ComposeDashboardDisk = {
  title: string;
  pct: number;
};

export type ComposeDashboardMachineStatus = {
  memPct: number | null;
  cpuPct: number | null;
  diskPct: number | null;
  disks?: ComposeDashboardDisk[] | null;
  load: [number, number, number] | null;
  cycleMinutes: number | null;
};

export type ComposeDashboardInput = {
  projects: ComposeDashboardProject[];
  machineStatus: ComposeDashboardMachineStatus | null;
  tokens: TokenStatus[];
  sevenDayWindowAggregate?: SevenDayWindowAggregate | null;
};

type ProjectColumn = {
  header: string;
  key: keyof DashboardRow;
};

const PROJECT_COLUMNS: ProjectColumn[] = [
  { header: 'td', key: 'todo' },
  { header: 'qc', key: 'qc' },
  { header: 'fl', key: 'fail' },
  { header: 'pp', key: 'pr' },
  { header: 'ws', key: 'ws' },
  { header: 'dp', key: 'dep' },
];

const PROJECT_COLUMN_WIDTH = 2;

const STORY_COLOR_COLUMNS: ProjectColumn[] = [
  { header: '🔴', key: 'humanPendingRed' },
  { header: '🟡', key: 'humanPendingYellow' },
  { header: '🔵', key: 'humanPendingBlue' },
];

const STORY_COLOR_COLUMN_VALUE_WIDTH = 2;

export const STATUS_DOT_DISPLAY_WIDTH = 2;

const SEVERITY_BLANK = ' '.repeat(STATUS_DOT_DISPLAY_WIDTH);

const TOKEN_NAME_WIDTH = 2;

export const TOKEN_UTILIZATION_WIDTH = 2;

const TOKEN_RESET_WIDTH = 7;

const TOKEN_SEGMENT_SEPARATOR = ' ';

const TOKEN_COLOR_DOT: Record<TokenStatusColor, string> = {
  G: '🟢',
  Y: '🟡',
  K: '⚪',
  R: '🔴',
};

const padEnd = (value: string, width: number, fill: string): string => {
  let result = value;
  while (result.length < width) {
    result = result + fill;
  }
  return result;
};

const padStart = (value: string, width: number): string => {
  let result = value;
  while (result.length < width) {
    result = ' ' + result;
  }
  return result;
};

const padStartZero = (value: string, width: number): string => {
  let result = value;
  while (result.length < width) {
    result = '0' + result;
  }
  return result;
};

export const roundHalfToEven = (value: number): number => {
  const floor = Math.floor(value);
  const difference = value - floor;
  if (difference < 0.5) {
    return floor;
  }
  if (difference > 0.5) {
    return floor + 1;
  }
  return floor % 2 === 0 ? floor : floor + 1;
};

export const formatResetCountdown = (totalSeconds: number): string => {
  if (totalSeconds < 0) {
    return '0d00h00';
  }
  const whole = Math.trunc(totalSeconds);
  const days = Math.trunc(whole / 86400);
  const afterDays = whole % 86400;
  const hours = Math.trunc(afterDays / 3600);
  const minutes = Math.trunc((afterDays % 3600) / 60);
  return `${days}d${padStartZero(String(hours), 2)}h${padStartZero(
    String(minutes),
    2,
  )}`;
};

const packTokensWithinBudget = (tokens: string[]): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const token of tokens) {
    const candidate = current === '' ? token : `${current} ${token}`;
    if (current !== '' && candidate.length > PROJECT_ROW_WIDTH_BUDGET) {
      lines.push(current);
      current = token;
    } else {
      current = candidate;
    }
  }
  if (current !== '') {
    lines.push(current);
  }
  return lines;
};

export const formatMachineStatusLines = (
  machineStatus: ComposeDashboardMachineStatus | null,
): string[] => {
  const memText =
    machineStatus !== null && machineStatus.memPct !== null
      ? `${machineStatus.memPct}%`
      : '?%';
  const cpuText =
    machineStatus !== null && machineStatus.cpuPct !== null
      ? `${machineStatus.cpuPct}%`
      : '?%';
  const diskText =
    machineStatus !== null && machineStatus.diskPct !== null
      ? `${machineStatus.diskPct}%`
      : '?%';
  const load = machineStatus !== null ? machineStatus.load : null;
  const oneMinute = load === null ? '?' : String(roundHalfToEven(load[0]));
  const fiveMinute = load === null ? '?' : String(roundHalfToEven(load[1]));
  const fifteenMinute = load === null ? '?' : String(roundHalfToEven(load[2]));
  const cycle =
    machineStatus !== null && machineStatus.cycleMinutes !== null
      ? `cy${machineStatus.cycleMinutes}`
      : 'cy-';
  const loadLine = `LA ${oneMinute} ${fiveMinute} ${fifteenMinute}`;
  const disks =
    machineStatus !== null && machineStatus.disks ? machineStatus.disks : null;
  if (disks !== null && disks.length > 0) {
    const diskTokens = disks.map((disk) => `${disk.title}${disk.pct}%`);
    const diskLines = packTokensWithinBudget(diskTokens);
    return [`M${memText} C${cpuText} ${cycle}`, ...diskLines, loadLine];
  }
  return [`M${memText} C${cpuText} D${diskText} ${cycle}`, loadLine];
};

const capTwoDigits = (value: number): string =>
  value > 99 ? '99' : String(value);

export const formatProjectHeaderLine = (): string => {
  const head = padEnd('pj', 4, ' ');
  const columns = PROJECT_COLUMNS.map(
    (column) => ' ' + padStart(column.header, PROJECT_COLUMN_WIDTH),
  ).join('');
  const storyColumns = STORY_COLOR_COLUMNS.map(
    (column) => ' ' + column.header,
  ).join('');
  return head + columns + storyColumns;
};

const severityDot = (row: DashboardRow): string => {
  if (row.blocker >= 2) {
    return '🔴';
  }
  if (row.blocker === 1) {
    return '🟣';
  }
  if (row.qc >= 15 || row.fail >= 5) {
    return '🟠';
  }
  if (row.qc >= 10 || row.fail >= 3) {
    return '🟡';
  }
  return '🟢';
};

export const formatProjectRowLine = (
  project: ComposeDashboardProject,
): string => {
  const mark = project.row === null ? SEVERITY_BLANK : severityDot(project.row);
  const cells = PROJECT_COLUMNS.map((column) => {
    const cell =
      project.row === null ? '--' : capTwoDigits(project.row[column.key]);
    return ' ' + padStart(cell, PROJECT_COLUMN_WIDTH);
  }).join('');
  const storyColorCells = STORY_COLOR_COLUMNS.map((column) => {
    const cell =
      project.row === null ? '--' : capTwoDigits(project.row[column.key]);
    return ' ' + padStart(cell, STORY_COLOR_COLUMN_VALUE_WIDTH);
  }).join('');
  return mark + padEnd(project.code, 2, ' ') + cells + storyColorCells;
};

const formatUtilization = (percent: number | null): string =>
  padStart(
    percent === null ? '?' : String(Math.min(percent, 99)),
    TOKEN_UTILIZATION_WIDTH,
  );

const formatReset = (resetSeconds: number | null): string =>
  resetSeconds === null ? '?' : formatResetCountdown(resetSeconds);

const tokenSortKey = (token: TokenStatus): [number, number] =>
  token.sevenDayResetSeconds === null
    ? [1, 0]
    : [0, token.sevenDayResetSeconds];

const sortTokens = (tokens: TokenStatus[]): TokenStatus[] =>
  tokens
    .map((token, index) => ({ token, index }))
    .sort((left, right) => {
      const leftKey = tokenSortKey(left.token);
      const rightKey = tokenSortKey(right.token);
      if (leftKey[0] !== rightKey[0]) {
        return leftKey[0] - rightKey[0];
      }
      if (leftKey[1] !== rightKey[1]) {
        return leftKey[1] - rightKey[1];
      }
      return left.index - right.index;
    })
    .map((entry) => entry.token);

const joinTokenRowSegments = (segments: string[]): string =>
  segments.join(TOKEN_SEGMENT_SEPARATOR);

export const SEVEN_DAY_UTILIZATION_COLUMN_START =
  STATUS_DOT_DISPLAY_WIDTH +
  TOKEN_NAME_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length +
  TOKEN_UTILIZATION_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length +
  TOKEN_RESET_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length;

export const TOKEN_SESSION_COLUMN_START =
  SEVEN_DAY_UTILIZATION_COLUMN_START +
  TOKEN_UTILIZATION_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length +
  TOKEN_RESET_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length;

export const formatTokenSessionTotalLine = (
  tokens: TokenStatus[],
): string | null => {
  if (tokens.length === 0) {
    return null;
  }
  const totalPrep = tokens.reduce((sum, t) => sum + t.prep, 0);
  const totalHum = tokens.reduce((sum, t) => sum + t.hum, 0);
  return (
    padEnd('', TOKEN_SESSION_COLUMN_START, ' ') +
    String(totalPrep) +
    ' ' +
    String(totalHum)
  );
};

export const formatSevenDayWindowAggregateLine = (
  aggregate: SevenDayWindowAggregate | null,
): string | null => {
  if (aggregate === null) {
    return null;
  }
  const usedPercent = roundHalfToEven(aggregate.usedPercent);
  const includedCountSuffix =
    aggregate.includedTokenCount === aggregate.totalTokenCount
      ? ''
      : ` (${aggregate.includedTokenCount})`;
  return (
    padEnd('', SEVEN_DAY_UTILIZATION_COLUMN_START, ' ') +
    formatUtilization(usedPercent) +
    includedCountSuffix
  );
};

export const formatTokenRowLine = (token: TokenStatus): string => {
  const dot = TOKEN_COLOR_DOT[token.color];
  const name = padEnd(token.name.slice(-TOKEN_NAME_WIDTH), TOKEN_NAME_WIDTH, '_');
  const fiveHourUtilization = formatUtilization(
    token.fiveHourUtilizationPercent,
  );
  const fiveHourReset = formatReset(token.fiveHourResetSeconds);
  const sevenDayUtilization = formatUtilization(
    token.sevenDayUtilizationPercent,
  );
  const sevenDayReset = formatReset(token.sevenDayResetSeconds);
  const prep = String(token.prep);
  const hum = String(token.hum);
  return joinTokenRowSegments([
    `${dot}${name}`,
    fiveHourUtilization,
    fiveHourReset,
    sevenDayUtilization,
    sevenDayReset,
    prep,
    hum,
  ]);
};

const wrapLine = (line: string): string =>
  `<tt>${line.replace(/ /g, '&nbsp;')}</tt><br>`;

export class ComposeDashboardUseCase {
  run = (input: ComposeDashboardInput): string => {
    const statsLines = formatMachineStatusLines(input.machineStatus);
    const projectLines = [
      formatProjectHeaderLine(),
      ...input.projects.map((project) => formatProjectRowLine(project)),
    ];
    const sortedTokens = sortTokens(input.tokens);
    const tokenLines = sortedTokens.map((token) => formatTokenRowLine(token));
    const aggregateLine = formatSevenDayWindowAggregateLine(
      input.sevenDayWindowAggregate ?? null,
    );
    const sessionTotalLine = formatTokenSessionTotalLine(sortedTokens);
    const lines = [
      ...statsLines,
      ...projectLines,
      aggregateLine === null ? '' : aggregateLine,
      ...(sessionTotalLine !== null ? [sessionTotalLine] : []),
      ...tokenLines,
    ];
    return lines.map((line) => wrapLine(line)).join('\n') + '\n';
  };
}
