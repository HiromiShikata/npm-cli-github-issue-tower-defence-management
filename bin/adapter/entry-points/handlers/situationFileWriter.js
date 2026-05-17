"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeSituationFile = exports.parseMeminfo = void 0;
const fs_1 = __importDefault(require("fs"));
const parseMeminfo = (meminfo) => {
    const getValue = (key) => {
        const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
        return match ? parseInt(match[1], 10) : 0;
    };
    return {
        memTotalKb: getValue('MemTotal'),
        memAvailableKb: getValue('MemAvailable'),
        swapTotalKb: getValue('SwapTotal'),
        swapFreeKb: getValue('SwapFree'),
    };
};
exports.parseMeminfo = parseMeminfo;
const kbToGib = (kb) => Math.round((kb / 1024 / 1024) * 100) / 100;
const toPercent = (used, total) => total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
const isImmediatelyActionable = (issue) => issue.dependedIssueUrls.length === 0 &&
    issue.nextActionDate === null &&
    issue.nextActionHour === null;
const countRunningProcesses = async (preparationIssues, commandTemplate, localCommandRunner) => {
    const resolvedTemplate = commandTemplate.replace('{URL}', '$1');
    const checks = await Promise.all(preparationIssues.map(async (issue) => {
        const { exitCode } = await localCommandRunner.runCommand('sh', [
            '-c',
            resolvedTemplate,
            '--',
            issue.url,
        ]);
        return exitCode === 0;
    }));
    return checks.filter(Boolean).length;
};
const writeSituationFile = async (params) => {
    const { cachePath, projectId, issues, statusNames, config, preparationProcessCheckCommand, localCommandRunner, } = params;
    const awaitingQualityCheckImmediatelyActionable = statusNames.awaitingQualityCheckStatus !== null
        ? issues.filter((i) => i.status === statusNames.awaitingQualityCheckStatus &&
            isImmediatelyActionable(i)).length
        : 0;
    const preparationIssues = statusNames.preparationStatus !== null
        ? issues.filter((i) => i.status === statusNames.preparationStatus)
        : [];
    const awaitingWorkspaceIssues = statusNames.awaitingWorkspaceStatus !== null
        ? issues.filter((i) => i.status === statusNames.awaitingWorkspaceStatus)
        : [];
    const awaitingWorkspaceImmediatelyActionable = awaitingWorkspaceIssues.filter(isImmediatelyActionable).length;
    const awaitingWorkspaceBlockedByDependency = awaitingWorkspaceIssues.filter((i) => i.dependedIssueUrls.length > 0).length;
    let runningPreparation = null;
    if (preparationProcessCheckCommand &&
        localCommandRunner &&
        preparationIssues.length > 0) {
        runningPreparation = await countRunningProcesses(preparationIssues, preparationProcessCheckCommand, localCommandRunner);
    }
    else if (preparationProcessCheckCommand && localCommandRunner) {
        runningPreparation = 0;
    }
    const meminfo = fs_1.default.readFileSync('/proc/meminfo', 'utf-8');
    const { memTotalKb, memAvailableKb, swapTotalKb, swapFreeKb } = (0, exports.parseMeminfo)(meminfo);
    const memUsedKb = memTotalKb - memAvailableKb;
    const swapUsedKb = swapTotalKb - swapFreeKb;
    const situation = {
        capturedAt: new Date().toISOString(),
        config,
        status: {
            awaitingQualityCheckImmediatelyActionable,
            preparation: preparationIssues.length,
            awaitingWorkspaceImmediatelyActionable,
            awaitingWorkspaceBlockedByDependency,
        },
        processes: {
            runningPreparation,
        },
        system: {
            memory: {
                usedPercent: toPercent(memUsedKb, memTotalKb),
                usedGib: kbToGib(memUsedKb),
                totalGib: kbToGib(memTotalKb),
            },
            swap: {
                usedPercent: toPercent(swapUsedKb, swapTotalKb),
                usedGib: kbToGib(swapUsedKb),
                totalGib: kbToGib(swapTotalKb),
            },
        },
    };
    const finalPath = `${cachePath}/situation-${projectId}.json`;
    const tmpPath = `${finalPath}.tmp`;
    fs_1.default.mkdirSync(cachePath, { recursive: true });
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(situation));
    fs_1.default.renameSync(tmpPath, finalPath);
};
exports.writeSituationFile = writeSituationFile;
//# sourceMappingURL=situationFileWriter.js.map