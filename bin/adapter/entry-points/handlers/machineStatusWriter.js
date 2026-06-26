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
const cacheFileMtimesDescending = (allIssuesCacheDir) => {
    let entries;
    try {
        entries = fs_1.default.readdirSync(allIssuesCacheDir);
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => {
        try {
            return fs_1.default.statSync(path_1.default.join(allIssuesCacheDir, entry)).mtimeMs / 1000;
        }
        catch {
            return null;
        }
    })
        .filter((value) => value !== null)
        .sort((a, b) => b - a);
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
    const cycleMinutes = allIssuesCacheDir
        ? (0, ProcHostMetricsRepository_1.cycleMinutesFromMtimes)(cacheFileMtimesDescending(allIssuesCacheDir))
        : null;
    const file = {
        memPct,
        cpuPct,
        diskPct,
        load: [load.oneMinute, load.fiveMinute, load.fifteenMinute],
        cycleMinutes,
        capturedAt: (params.now ?? new Date()).toISOString(),
    };
    writeJsonAtomic(path_1.default.join(dashboardDataDir, 'machine-status.json'), file);
};
exports.writeMachineStatus = writeMachineStatus;
//# sourceMappingURL=machineStatusWriter.js.map