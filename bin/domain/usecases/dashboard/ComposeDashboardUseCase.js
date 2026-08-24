"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComposeDashboardUseCase = exports.formatTokenRowLine = exports.formatSevenDayWindowAggregateLine = exports.SEVEN_DAY_UTILIZATION_COLUMN_START = exports.formatProjectRowLine = exports.formatProjectHeaderLine = exports.formatMachineStatusLines = exports.formatResetCountdown = exports.roundHalfToEven = exports.TOKEN_UTILIZATION_WIDTH = exports.STATUS_DOT_DISPLAY_WIDTH = exports.PROJECT_ROW_WIDTH_BUDGET = void 0;
exports.PROJECT_ROW_WIDTH_BUDGET = 32;
const PROJECT_COLUMNS = [
    { header: 'tdo', key: 'todo' },
    { header: 'aqc', key: 'qc' },
    { header: 'fal', key: 'fail' },
    { header: 'prp', key: 'pr' },
    { header: 'aws', key: 'ws' },
    { header: 'dep', key: 'dep' },
];
const PROJECT_COLUMN_WIDTH = 3;
exports.STATUS_DOT_DISPLAY_WIDTH = 2;
const SEVERITY_BLANK = ' '.repeat(exports.STATUS_DOT_DISPLAY_WIDTH);
const TOKEN_NAME_WIDTH = 4;
exports.TOKEN_UTILIZATION_WIDTH = 4;
const TOKEN_RESET_WIDTH = 7;
const TOKEN_SEGMENT_SEPARATOR = ' ';
const TOKEN_COLOR_DOT = {
    G: '🟢',
    Y: '🟡',
    K: '⚪',
};
const padEnd = (value, width, fill) => {
    let result = value;
    while (result.length < width) {
        result = result + fill;
    }
    return result;
};
const padStart = (value, width) => {
    let result = value;
    while (result.length < width) {
        result = ' ' + result;
    }
    return result;
};
const padStartZero = (value, width) => {
    let result = value;
    while (result.length < width) {
        result = '0' + result;
    }
    return result;
};
const roundHalfToEven = (value) => {
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
exports.roundHalfToEven = roundHalfToEven;
const formatResetCountdown = (totalSeconds) => {
    if (totalSeconds < 0) {
        return '0d00h00';
    }
    const whole = Math.trunc(totalSeconds);
    const days = Math.trunc(whole / 86400);
    const afterDays = whole % 86400;
    const hours = Math.trunc(afterDays / 3600);
    const minutes = Math.trunc((afterDays % 3600) / 60);
    return `${days}d${padStartZero(String(hours), 2)}h${padStartZero(String(minutes), 2)}`;
};
exports.formatResetCountdown = formatResetCountdown;
const packTokensWithinBudget = (tokens) => {
    const lines = [];
    let current = '';
    for (const token of tokens) {
        const candidate = current === '' ? token : `${current} ${token}`;
        if (current !== '' && candidate.length > exports.PROJECT_ROW_WIDTH_BUDGET) {
            lines.push(current);
            current = token;
        }
        else {
            current = candidate;
        }
    }
    if (current !== '') {
        lines.push(current);
    }
    return lines;
};
const formatMachineStatusLines = (machineStatus) => {
    const memText = machineStatus !== null && machineStatus.memPct !== null
        ? `${machineStatus.memPct}%`
        : '?%';
    const cpuText = machineStatus !== null && machineStatus.cpuPct !== null
        ? `${machineStatus.cpuPct}%`
        : '?%';
    const diskText = machineStatus !== null && machineStatus.diskPct !== null
        ? `${machineStatus.diskPct}%`
        : '?%';
    const load = machineStatus !== null ? machineStatus.load : null;
    const oneMinute = load === null ? '?' : String((0, exports.roundHalfToEven)(load[0]));
    const fiveMinute = load === null ? '?' : String((0, exports.roundHalfToEven)(load[1]));
    const fifteenMinute = load === null ? '?' : String((0, exports.roundHalfToEven)(load[2]));
    const cycle = machineStatus !== null && machineStatus.cycleMinutes !== null
        ? `cy${machineStatus.cycleMinutes}`
        : 'cy-';
    const loadLine = `LA ${oneMinute} ${fiveMinute} ${fifteenMinute}`;
    const disks = machineStatus !== null && machineStatus.disks ? machineStatus.disks : null;
    if (disks !== null && disks.length > 0) {
        const diskTokens = disks.map((disk) => `${disk.title}${disk.pct}%`);
        const diskLines = packTokensWithinBudget(diskTokens);
        return [`M${memText} C${cpuText} ${cycle}`, ...diskLines, loadLine];
    }
    return [`M${memText} C${cpuText} D${diskText} ${cycle}`, loadLine];
};
exports.formatMachineStatusLines = formatMachineStatusLines;
const capThreeDigits = (value) => value > 999 ? '999' : String(value);
const formatProjectHeaderLine = () => {
    const head = padEnd('pj', 4, ' ');
    const columns = PROJECT_COLUMNS.map((column) => ' ' + padStart(column.header, PROJECT_COLUMN_WIDTH)).join('');
    return head + columns;
};
exports.formatProjectHeaderLine = formatProjectHeaderLine;
const severityDot = (row) => {
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
const formatProjectRowLine = (project) => {
    const mark = project.row === null ? SEVERITY_BLANK : severityDot(project.row);
    const cells = PROJECT_COLUMNS.map((column) => {
        const cell = project.row === null ? '--' : capThreeDigits(project.row[column.key]);
        return ' ' + padStart(cell, PROJECT_COLUMN_WIDTH);
    }).join('');
    return mark + padEnd(project.code, 2, ' ') + cells;
};
exports.formatProjectRowLine = formatProjectRowLine;
const formatUtilization = (percent) => padStart(percent === null ? '?' : `${percent}%`, exports.TOKEN_UTILIZATION_WIDTH);
const formatReset = (resetSeconds) => resetSeconds === null ? '?' : (0, exports.formatResetCountdown)(resetSeconds);
const tokenSortKey = (token) => token.sevenDayResetSeconds === null
    ? [1, 0]
    : [0, token.sevenDayResetSeconds];
const sortTokens = (tokens) => tokens
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
const joinTokenRowSegments = (segments) => segments.join(TOKEN_SEGMENT_SEPARATOR);
exports.SEVEN_DAY_UTILIZATION_COLUMN_START = exports.STATUS_DOT_DISPLAY_WIDTH +
    TOKEN_NAME_WIDTH +
    TOKEN_SEGMENT_SEPARATOR.length +
    exports.TOKEN_UTILIZATION_WIDTH +
    TOKEN_SEGMENT_SEPARATOR.length +
    TOKEN_RESET_WIDTH +
    TOKEN_SEGMENT_SEPARATOR.length;
const formatSevenDayWindowAggregateLine = (aggregate) => {
    if (aggregate === null) {
        return null;
    }
    const usedPercent = (0, exports.roundHalfToEven)(aggregate.usedPercent);
    const includedCountSuffix = aggregate.includedTokenCount === aggregate.totalTokenCount
        ? ''
        : ` (${aggregate.includedTokenCount})`;
    return (padEnd('', exports.SEVEN_DAY_UTILIZATION_COLUMN_START, ' ') +
        formatUtilization(usedPercent) +
        includedCountSuffix);
};
exports.formatSevenDayWindowAggregateLine = formatSevenDayWindowAggregateLine;
const formatTokenRowLine = (token) => {
    const dot = TOKEN_COLOR_DOT[token.color];
    const name = padEnd(token.name, TOKEN_NAME_WIDTH, '_');
    const fiveHourUtilization = formatUtilization(token.fiveHourUtilizationPercent);
    const fiveHourReset = formatReset(token.fiveHourResetSeconds);
    const sevenDayUtilization = formatUtilization(token.sevenDayUtilizationPercent);
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
exports.formatTokenRowLine = formatTokenRowLine;
const wrapLine = (line) => `<tt>${line.replace(/ /g, '&nbsp;')}</tt><br>`;
class ComposeDashboardUseCase {
    constructor() {
        this.run = (input) => {
            const statsLines = (0, exports.formatMachineStatusLines)(input.machineStatus);
            const projectLines = [
                (0, exports.formatProjectHeaderLine)(),
                ...input.projects.map((project) => (0, exports.formatProjectRowLine)(project)),
            ];
            const tokenLines = sortTokens(input.tokens).map((token) => (0, exports.formatTokenRowLine)(token));
            const aggregateLine = (0, exports.formatSevenDayWindowAggregateLine)(input.sevenDayWindowAggregate ?? null);
            const lines = [
                ...statsLines,
                ...projectLines,
                aggregateLine === null ? '' : aggregateLine,
                ...tokenLines,
            ];
            return lines.map((line) => wrapLine(line)).join('\n') + '\n';
        };
    }
}
exports.ComposeDashboardUseCase = ComposeDashboardUseCase;
//# sourceMappingURL=ComposeDashboardUseCase.js.map