"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMachineStatus = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ProcHostMetricsRepository_1 = require("../../repositories/ProcHostMetricsRepository");
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const isRecord = (value) => typeof value === 'object' && value !== null;
const readLastFetchedAtFromJsonFile = (filePath) => {
    let raw;
    try {
        raw = fs_1.default.readFileSync(filePath, 'utf8');
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (isRecord(parsed) && typeof parsed.lastFetchedAt === 'string') {
        return parsed.lastFetchedAt;
    }
    return null;
};
const writeMachineStatus = async (params) => {
    const { dashboardDataDir, allIssuesCacheDir } = params;
    if (!dashboardDataDir) {
        return;
    }
    const hostMetricsRepository = params.hostMetricsRepository ?? new ProcHostMetricsRepository_1.ProcHostMetricsRepository();
    const memPct = hostMetricsRepository.readMemoryUsedPercent();
    const cpuPct = await hostMetricsRepository.readCpuUsedPercent();
    const diskPct = hostMetricsRepository.readDiskUsedPercent();
    const load = hostMetricsRepository.readLoadAverages();
    const machineStatusPath = path_1.default.join(dashboardDataDir, 'machine-status.json');
    const previousLastFetchedAt = readLastFetchedAtFromJsonFile(machineStatusPath);
    const currentLastFetchedAt = allIssuesCacheDir
        ? readLastFetchedAtFromJsonFile(path_1.default.join(allIssuesCacheDir, 'latest.json'))
        : null;
    const cycleMinutes = (0, ProcHostMetricsRepository_1.cycleMinutesFromFetchTimestamps)(previousLastFetchedAt, currentLastFetchedAt);
    const file = {
        memPct,
        cpuPct,
        diskPct,
        load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
        cycleMinutes,
        lastFetchedAt: currentLastFetchedAt,
        capturedAt: (params.now ?? new Date()).toISOString(),
    };
    writeJsonAtomic(machineStatusPath, file);
};
exports.writeMachineStatus = writeMachineStatus;
//# sourceMappingURL=machineStatusWriter.js.map