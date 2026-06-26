"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcHostMetricsRepository = exports.cycleMinutesFromMtimes = exports.parseLoadAverages = exports.parseDiskUsedPercent = exports.cpuUsedPercentFromSamples = exports.parseCpuSample = exports.parseMemoryUsedPercent = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_PROC_DIRECTORY = '/proc';
const DEFAULT_ROOT_PATH = '/';
const CPU_SAMPLE_INTERVAL_MS = 400;
const parseMemoryUsedPercent = (meminfoText) => {
    const fields = new Map();
    for (const line of meminfoText.split('\n')) {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        const valuePart = line
            .slice(separatorIndex + 1)
            .trim()
            .split(/\s+/)[0];
        const value = Number(valuePart);
        if (Number.isFinite(value)) {
            fields.set(key, value);
        }
    }
    const total = fields.get('MemTotal');
    const available = fields.get('MemAvailable');
    if (total === undefined || available === undefined) {
        throw new Error('MemTotal and MemAvailable are required');
    }
    if (total <= 0) {
        throw new Error('MemTotal must be positive');
    }
    const used = total - available;
    return Math.round((used / total) * 100);
};
exports.parseMemoryUsedPercent = parseMemoryUsedPercent;
const parseCpuSample = (statText) => {
    for (const line of statText.split('\n')) {
        if (line.startsWith('cpu ')) {
            const values = line
                .trim()
                .split(/\s+/)
                .slice(1)
                .map((value) => Number(value));
            if (values.some((value) => !Number.isFinite(value))) {
                throw new Error('aggregate cpu line contains non-numeric values');
            }
            const idle = values[3] + (values.length > 4 ? values[4] : 0);
            const total = values.reduce((sum, value) => sum + value, 0);
            return { total, idle };
        }
    }
    throw new Error('aggregate cpu line not found');
};
exports.parseCpuSample = parseCpuSample;
const cpuUsedPercentFromSamples = (first, second) => {
    const totalDelta = second.total - first.total;
    const idleDelta = second.idle - first.idle;
    if (totalDelta <= 0) {
        throw new Error('total delta must be positive');
    }
    const busyDelta = totalDelta - idleDelta;
    return Math.round((busyDelta / totalDelta) * 100);
};
exports.cpuUsedPercentFromSamples = cpuUsedPercentFromSamples;
const parseDiskUsedPercent = (blocks, bfree, bavail) => {
    const total = blocks - bfree + bavail;
    if (total <= 0) {
        throw new Error('disk total must be positive');
    }
    const used = blocks - bfree;
    return Math.round((used / total) * 100);
};
exports.parseDiskUsedPercent = parseDiskUsedPercent;
const parseLoadAverages = (loadavgText) => {
    const parts = loadavgText.trim().split(/\s+/);
    const oneMinute = Number(parts[0]);
    const fiveMinute = Number(parts[1]);
    const fifteenMinute = Number(parts[2]);
    if (!Number.isFinite(oneMinute) ||
        !Number.isFinite(fiveMinute) ||
        !Number.isFinite(fifteenMinute)) {
        throw new Error('loadavg must contain three numeric values');
    }
    return { oneMinute, fiveMinute, fifteenMinute };
};
exports.parseLoadAverages = parseLoadAverages;
const cycleMinutesFromMtimes = (mtimesDescendingSeconds) => {
    if (mtimesDescendingSeconds.length < 2) {
        return null;
    }
    return Math.round((mtimesDescendingSeconds[0] - mtimesDescendingSeconds[1]) / 60);
};
exports.cycleMinutesFromMtimes = cycleMinutesFromMtimes;
class ProcHostMetricsRepository {
    constructor(procDirectory = DEFAULT_PROC_DIRECTORY, sleep = (milliseconds) => new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    }), readDiskBlocks = (rootPath) => {
        const stats = fs.statfsSync(rootPath);
        return {
            blocks: Number(stats.blocks),
            bfree: Number(stats.bfree),
            bavail: Number(stats.bavail),
        };
    }, rootPath = DEFAULT_ROOT_PATH) {
        this.procDirectory = procDirectory;
        this.sleep = sleep;
        this.readDiskBlocks = readDiskBlocks;
        this.rootPath = rootPath;
        this.readMemoryUsedPercent = () => (0, exports.parseMemoryUsedPercent)(fs.readFileSync(path.join(this.procDirectory, 'meminfo'), 'utf8'));
        this.readCpuUsedPercent = async () => {
            const first = (0, exports.parseCpuSample)(fs.readFileSync(path.join(this.procDirectory, 'stat'), 'utf8'));
            await this.sleep(CPU_SAMPLE_INTERVAL_MS);
            const second = (0, exports.parseCpuSample)(fs.readFileSync(path.join(this.procDirectory, 'stat'), 'utf8'));
            return (0, exports.cpuUsedPercentFromSamples)(first, second);
        };
        this.readLoadAverages = () => (0, exports.parseLoadAverages)(fs.readFileSync(path.join(this.procDirectory, 'loadavg'), 'utf8'));
        this.readDiskUsedPercent = () => {
            const { blocks, bfree, bavail } = this.readDiskBlocks(this.rootPath);
            return (0, exports.parseDiskUsedPercent)(blocks, bfree, bavail);
        };
    }
}
exports.ProcHostMetricsRepository = ProcHostMetricsRepository;
//# sourceMappingURL=ProcHostMetricsRepository.js.map