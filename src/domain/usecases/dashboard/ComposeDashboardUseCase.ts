import {
  CodexSevenDayWindowStatus,
  isCodexSevenDayWindowReset,
} from './CodexSevenDayWindowUseCase';
import { DashboardRow } from './GenerateDashboardRowUseCase';
import {
  HIGH_UTILIZATION_THRESHOLD,
  SevenDayWindowAggregate,
  TokenStatus,
  TokenStatusColor,
} from './GenerateTokenStatusUseCase';

export const PROJECT_ROW_WIDTH_BUDGET = 43;

export type CloseEventCounts = {
  h1: number;
  h3: number;
  h5: number;
};

export type ComposeDashboardProject = {
  code: string;
  row: DashboardRow | null;
  closeEventCounts: CloseEventCounts;
  rowCapturedAt?: string | null;
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

export type ComposeDashboardRemoteMachine = {
  name: string;
  reachable: boolean;
  memPct: number | null;
  cpuPct: number | null;
  diskPct: number | null;
  load: [number, number, number] | null;
};

export type ComposeDashboardInput = {
  projects: ComposeDashboardProject[];
  machineStatus: ComposeDashboardMachineStatus | null;
  remoteMachines?: ComposeDashboardRemoteMachine[] | null;
  tokens: TokenStatus[];
  sevenDayWindowAggregate?: SevenDayWindowAggregate | null;
  codexSevenDayWindows?: CodexSevenDayWindowStatus[] | null;
  codexRunningWorkerCount?: number | null;
  nowMs?: number;
};

export const dashboardComposeInputHasProjectData = (
  input: ComposeDashboardInput,
): boolean => input.projects.some((project) => project.row !== null);

type ProjectColumn = {
  header: string;
  key: keyof DashboardRow;
};

const PROJECT_COLUMNS: ProjectColumn[] = [
  { header: 'td', key: 'todo' },
  { header: 'ao', key: 'qc' },
  { header: 'fl', key: 'fail' },
  { header: 'pp', key: 'pr' },
  { header: 'ws', key: 'ws' },
  { header: 'dp', key: 'dep' },
];

const PROJECT_COLUMN_WIDTH = 2;

const STORY_COLOR_COLUMNS: ProjectColumn[] = [
  { header: '🔴', key: 'humanPendingRed' },
  { header: '🟡', key: 'humanPendingYellow' },
];

const STORY_COLOR_COLUMN_VALUE_WIDTH = 2;

type CloseCountColumn = {
  header: string;
  key: keyof CloseEventCounts;
};

const CLOSE_COUNT_COLUMNS: CloseCountColumn[] = [
  { header: '1h', key: 'h1' },
  { header: '3h', key: 'h3' },
  { header: '5h', key: 'h5' },
];

const CLOSE_COUNT_COLUMN_WIDTH = 2;

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

export const formatElapsedMinutes = (elapsedMs: number): string => {
  const totalMinutes = Math.floor(elapsedMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
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

const capTwoDigits = (value: number): string =>
  value > 99 ? '99' : String(value);

const padEndByCodePoint = (value: string, width: number): string =>
  value + ' '.repeat(Math.max(0, width - [...value].length));

export const formatMachineStatusLines = (
  machineStatus: ComposeDashboardMachineStatus | null,
  remoteMachines: ComposeDashboardRemoteMachine[] | null = null,
): string[] => {
  const remoteRows = remoteMachines ?? [];
  const rowNames = ['main', ...remoteRows.map((remote) => remote.name)];
  const nameWidth = Math.max(
    ...rowNames.map((name) => [...name].length),
    machineStatus?.disks?.length ? 8 : 0,
  );
  const header =
    ' '.repeat(STATUS_DOT_DISPLAY_WIDTH + nameWidth) +
    ['M', 'C', 'D', 'S', 'cy', 'LA']
      .map((label) => ` ${padStart(label, 2)}`)
      .join('');
  const formatValue = (value: number | null, isLoad: boolean): string =>
    value === null
      ? '?'
      : capTwoDigits(isLoad ? roundHalfToEven(value) : value);
  const formatRow = (
    name: string,
    values: Array<number | string | null>,
    forcedRed: boolean,
  ): string => {
    const numericValues = values
      .map((value, index) => ({ value, index }))
      .filter(
        (entry): entry is { value: number; index: number } =>
          typeof entry.value === 'number',
      );
    const red =
      forcedRed ||
      numericValues.some(
        ({ value, index }) =>
          (index < 4 && value >= 90) || (index === 5 && value >= 10),
      );
    const yellow =
      !red &&
      numericValues.some(
        ({ value, index }) =>
          (index < 4 && value >= 80) || (index === 5 && value >= 5),
      );
    const statusDot = red ? '🔴' : yellow ? '🟡' : '🟢';
    const paddedName = padEndByCodePoint(name, nameWidth);
    const formattedValues = values
      .map((value, index) => {
        const text =
          typeof value === 'string' ? value : formatValue(value, index >= 5);
        if (index === 0 && nameWidth === 4) return `   ${text}`;
        return ` ${padStart(text, 2)}`;
      })
      .join('');
    return `${statusDot}${paddedName}${formattedValues}`;
  };
  const mainDisk =
    machineStatus?.disks?.find((disk) => disk.title === 'S')?.pct ?? null;
  const mainValues =
    machineStatus === null
      ? Array<number | null>(8).fill(null)
      : [
          machineStatus.memPct,
          machineStatus.cpuPct,
          machineStatus.diskPct,
          mainDisk === null ? '-' : mainDisk,
          machineStatus.cycleMinutes === null
            ? '-'
            : machineStatus.cycleMinutes,
          ...(machineStatus.load ?? [null, null, null]),
        ];
  const lines = [header, formatRow('main', mainValues, machineStatus === null)];
  for (const remote of remoteRows) {
    lines.push(
      formatRow(
        remote.name,
        remote.reachable
          ? [
              remote.memPct,
              remote.cpuPct,
              remote.diskPct,
              '-',
              '-',
              ...(remote.load ?? [null, null, null]),
            ]
          : Array<number | null>(8).fill(null),
        !remote.reachable,
      ),
    );
  }
  return lines;
};

export const formatProjectTotalLine = (
  projects: ComposeDashboardProject[],
): string => {
  const head = ' '.repeat(STATUS_DOT_DISPLAY_WIDTH + 2);
  const validRows = projects
    .map((p) => p.row)
    .filter((row): row is DashboardRow => row !== null);
  const cells = PROJECT_COLUMNS.map((column) => {
    const total = validRows.reduce((sum, row) => sum + row[column.key], 0);
    return ' ' + padStart(capTwoDigits(total), PROJECT_COLUMN_WIDTH);
  }).join('');
  const storyColorCells = STORY_COLOR_COLUMNS.map((column) => {
    const total = validRows.reduce((sum, row) => sum + row[column.key], 0);
    return ' ' + padStart(capTwoDigits(total), STORY_COLOR_COLUMN_VALUE_WIDTH);
  }).join('');
  const closeCountCells = CLOSE_COUNT_COLUMNS.map((column) => {
    const total = projects.reduce(
      (sum, p) => sum + p.closeEventCounts[column.key],
      0,
    );
    return ' ' + padStart(capTwoDigits(total), CLOSE_COUNT_COLUMN_WIDTH);
  }).join('');
  return head + cells + storyColorCells + closeCountCells;
};

export const formatProjectHeaderLine = (): string => {
  const head =
    ' '.repeat(STATUS_DOT_DISPLAY_WIDTH) +
    padEnd('pj', PROJECT_COLUMN_WIDTH, ' ');
  const columns = PROJECT_COLUMNS.map(
    (column) => ' ' + padStart(column.header, PROJECT_COLUMN_WIDTH),
  ).join('');
  const storyColumns = STORY_COLOR_COLUMNS.map(
    (column) => ' ' + column.header,
  ).join('');
  const closeCountColumns = CLOSE_COUNT_COLUMNS.map(
    (column) => ' ' + padStart(column.header, CLOSE_COUNT_COLUMN_WIDTH),
  ).join('');
  return head + columns + storyColumns + closeCountColumns;
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
  nowMs?: number,
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
  const closeCountCells = CLOSE_COUNT_COLUMNS.map((column) => {
    const cell = capTwoDigits(project.closeEventCounts[column.key]);
    return ' ' + padStart(cell, CLOSE_COUNT_COLUMN_WIDTH);
  }).join('');
  const capturedAt = project.rowCapturedAt ?? null;
  const ageSuffix =
    capturedAt !== null && nowMs !== undefined
      ? (() => {
          const elapsed = nowMs - new Date(capturedAt).getTime();
          if (isNaN(elapsed) || elapsed < 0) return '';
          const age = formatElapsedMinutes(elapsed);
          return ` ${age}`;
        })()
      : '';
  return (
    mark +
    padEnd(project.code, 2, ' ') +
    cells +
    storyColorCells +
    closeCountCells +
    ageSuffix
  );
};

const formatUtilization = (percent: number | null): string =>
  padStart(
    percent === null ? '?' : String(Math.min(percent, 99)),
    TOKEN_UTILIZATION_WIDTH,
  );

const formatReset = (
  resetSeconds: number | null,
  utilizationPercent: number | null,
): string =>
  resetSeconds === null
    ? utilizationPercent === null
      ? padEnd('?', TOKEN_RESET_WIDTH, ' ')
      : padEnd('--', TOKEN_RESET_WIDTH, ' ')
    : formatResetCountdown(resetSeconds);

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
  STATUS_DOT_DISPLAY_WIDTH + TOKEN_NAME_WIDTH + TOKEN_SEGMENT_SEPARATOR.length;

export const TOKEN_SESSION_COLUMN_START =
  SEVEN_DAY_UTILIZATION_COLUMN_START +
  TOKEN_UTILIZATION_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length +
  TOKEN_RESET_WIDTH +
  TOKEN_SEGMENT_SEPARATOR.length;

export const formatTokenSectionHeaderLine = (): string =>
  padEnd('', SEVEN_DAY_UTILIZATION_COLUMN_START, ' ') +
  padEnd('7d', TOKEN_UTILIZATION_WIDTH, ' ') +
  TOKEN_SEGMENT_SEPARATOR +
  padStart('reset', TOKEN_RESET_WIDTH) +
  TOKEN_SEGMENT_SEPARATOR +
  padEnd('pp', TOKEN_UTILIZATION_WIDTH, ' ') +
  TOKEN_SEGMENT_SEPARATOR +
  padStart('h', 2) +
  TOKEN_SEGMENT_SEPARATOR +
  'sa' +
  TOKEN_SEGMENT_SEPARATOR +
  'sx';

const UNAVAILABLE_SUBAGENT_COUNT_TEXT = '-';

const formatSubagentCount = (count: number | null): string =>
  count === null
    ? padStart(UNAVAILABLE_SUBAGENT_COUNT_TEXT, 2)
    : padStart(capTwoDigits(count), 2);

const sumSubagentCounts = (counts: (number | null)[]): number | null =>
  counts.some((count) => count === null)
    ? null
    : counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);

export const formatTokenSessionTotalLine = (
  tokens: TokenStatus[],
  runningCodexWorkerCount: number | null,
): string | null => {
  const codexWorkerCount = runningCodexWorkerCount ?? 0;
  if (tokens.length === 0 && codexWorkerCount === 0) {
    return null;
  }
  const totalPrep =
    tokens.reduce((sum, t) => sum + t.prep, 0) + codexWorkerCount;
  const totalHum = tokens.reduce((sum, t) => sum + t.hum, 0);
  const totalClaudeSubagents = sumSubagentCounts(
    tokens.map((token) => token.claudeSubagentCount),
  );
  const totalCodexSubagents = sumSubagentCounts(
    tokens.map((token) => token.codexSubagentCount),
  );
  return (
    padEnd('', TOKEN_SESSION_COLUMN_START, ' ') +
    padStart(capTwoDigits(totalPrep), 2) +
    ' ' +
    padStart(capTwoDigits(totalHum), 2) +
    ' ' +
    formatSubagentCount(totalClaudeSubagents) +
    ' ' +
    formatSubagentCount(totalCodexSubagents)
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

const formatTokenName = (name: string): string =>
  padEnd(name.slice(-TOKEN_NAME_WIDTH), TOKEN_NAME_WIDTH, '_');

export const formatTokenRowLine = (token: TokenStatus): string => {
  const dot = TOKEN_COLOR_DOT[token.color];
  const name = formatTokenName(token.name);
  const sevenDayUtilization = formatUtilization(
    token.sevenDayUtilizationPercent,
  );
  const sevenDayReset = formatReset(
    token.sevenDayResetSeconds,
    token.sevenDayUtilizationPercent,
  );
  const prep = padStart(capTwoDigits(token.prep), 2);
  const hum = padStart(capTwoDigits(token.hum), 2);
  const claudeSubagentCount = formatSubagentCount(token.claudeSubagentCount);
  const codexSubagentCount = formatSubagentCount(token.codexSubagentCount);
  return joinTokenRowSegments([
    `${dot}${name}`,
    sevenDayUtilization,
    sevenDayReset,
    prep,
    hum,
    claudeSubagentCount,
    codexSubagentCount,
  ]);
};

const CODEX_DEFAULT_HOME = '.codex';

const CODEX_DEFAULT_TOKEN_NAME = 'cx';

const CODEX_PLACEHOLDER_WINDOW: CodexSevenDayWindowStatus = {
  codexHome: CODEX_DEFAULT_HOME,
  state: 'no-data',
  usedPercent: null,
  resetsAtEpochSeconds: null,
  capturedAt: null,
  errorMessage: null,
};

const isCodexWindowResetPassed = (
  window: CodexSevenDayWindowStatus,
  nowEpochSeconds: number,
): boolean =>
  window.resetsAtEpochSeconds !== null &&
  isCodexSevenDayWindowReset(window.resetsAtEpochSeconds, nowEpochSeconds);

const codexSevenDayTokenColorAt = (
  window: CodexSevenDayWindowStatus,
  nowEpochSeconds: number,
): TokenStatusColor => {
  if (window.state !== 'observed' || window.usedPercent === null) {
    return 'Y';
  }
  if (isCodexWindowResetPassed(window, nowEpochSeconds)) {
    return 'G';
  }
  if (window.usedPercent >= 100) {
    return 'K';
  }
  if (window.usedPercent / 100 >= HIGH_UTILIZATION_THRESHOLD) {
    return 'Y';
  }
  return 'G';
};

export const codexSevenDayTokenColor = (
  window: CodexSevenDayWindowStatus,
): TokenStatusColor =>
  codexSevenDayTokenColorAt(window, Math.floor(Date.now() / 1000));

const formatCodexUtilization = (
  window: CodexSevenDayWindowStatus,
  nowEpochSeconds: number,
): string => {
  if (window.state !== 'observed' || window.usedPercent === null) {
    return formatUtilization(null);
  }
  if (isCodexWindowResetPassed(window, nowEpochSeconds)) {
    return formatUtilization(0);
  }
  return formatUtilization(roundHalfToEven(window.usedPercent));
};

const formatCodexReset = (
  window: CodexSevenDayWindowStatus,
  nowEpochSeconds: number,
): string => {
  if (window.state !== 'observed' || window.resetsAtEpochSeconds === null) {
    return formatReset(null, null);
  }
  if (isCodexWindowResetPassed(window, nowEpochSeconds)) {
    return formatReset(null, 0);
  }
  return formatResetCountdown(window.resetsAtEpochSeconds - nowEpochSeconds);
};

export const formatCodexTokenRowLine = (
  window: CodexSevenDayWindowStatus,
  options: { nowMs: number; runningCodexWorkerCount: number | null },
): string => {
  const nowEpochSeconds = Math.floor(options.nowMs / 1000);
  const dot =
    TOKEN_COLOR_DOT[codexSevenDayTokenColorAt(window, nowEpochSeconds)];
  const name =
    window.codexHome === CODEX_DEFAULT_HOME
      ? CODEX_DEFAULT_TOKEN_NAME
      : formatTokenName(window.codexHome);
  const prep =
    options.runningCodexWorkerCount === null
      ? padStart('?', 2)
      : padStart(capTwoDigits(options.runningCodexWorkerCount), 2);
  const row = joinTokenRowSegments([
    `${dot}${name}`,
    formatCodexUtilization(window, nowEpochSeconds),
    formatCodexReset(window, nowEpochSeconds),
    prep,
    '-',
  ]);
  if (window.capturedAt === null) {
    return row;
  }
  return `${row} ${formatElapsedMinutes(
    options.nowMs - Date.parse(window.capturedAt),
  )}`;
};

export const formatCodexSevenDayWindowLines = (
  windows: CodexSevenDayWindowStatus[] | null,
  options: { nowMs: number; runningCodexWorkerCount: number | null },
): string[] => {
  if (windows === null) {
    return [];
  }
  const rows = windows.length === 0 ? [CODEX_PLACEHOLDER_WINDOW] : windows;
  return rows.map((window) => formatCodexTokenRowLine(window, options));
};

const wrapLine = (line: string): string =>
  `<tt>${line.replace(/ /g, '&nbsp;')}</tt><br>`;

export class ComposeDashboardUseCase {
  run = (input: ComposeDashboardInput): string => {
    const nowMs = input.nowMs;
    const statsLines = formatMachineStatusLines(
      input.machineStatus,
      input.remoteMachines ?? null,
    );
    const projectLines = [
      formatProjectTotalLine(input.projects),
      formatProjectHeaderLine(),
      ...input.projects.map((project) => formatProjectRowLine(project, nowMs)),
    ];
    const sortedTokens = sortTokens(input.tokens);
    const tokenLines = sortedTokens.map((token) => formatTokenRowLine(token));
    const aggregateLine = formatSevenDayWindowAggregateLine(
      input.sevenDayWindowAggregate ?? null,
    );
    const runningCodexWorkerCount = input.codexRunningWorkerCount ?? null;
    const sessionTotalLine = formatTokenSessionTotalLine(
      sortedTokens,
      runningCodexWorkerCount,
    );
    const aggrTotalLines = (() => {
      if (aggregateLine !== null && sessionTotalLine !== null) {
        const aggrPadded = padEnd(
          aggregateLine,
          TOKEN_SESSION_COLUMN_START,
          ' ',
        );
        return [
          formatTokenSectionHeaderLine(),
          aggrPadded + sessionTotalLine.slice(TOKEN_SESSION_COLUMN_START),
        ];
      }
      if (aggregateLine !== null) {
        return [formatTokenSectionHeaderLine(), aggregateLine];
      }
      if (sessionTotalLine !== null) {
        return ['', formatTokenSectionHeaderLine(), sessionTotalLine];
      }
      return [''];
    })();
    const codexLines = formatCodexSevenDayWindowLines(
      input.codexSevenDayWindows ?? null,
      {
        nowMs: input.nowMs ?? Date.now(),
        runningCodexWorkerCount,
      },
    );
    const lines = [
      ...statsLines,
      ...projectLines,
      ...aggrTotalLines,
      ...tokenLines,
      ...codexLines,
    ];
    return lines.map((line) => wrapLine(line)).join('\n') + '\n';
  };
}
