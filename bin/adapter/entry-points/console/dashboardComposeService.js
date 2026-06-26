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
exports.composeDashboardText = exports.dashboardComposeFilesPresent = exports.buildComposeDashboardInput = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ComposeDashboardUseCase_1 = require("../../../domain/usecases/dashboard/ComposeDashboardUseCase");
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readJsonFile = (filePath) => {
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf8');
    }
    catch {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
const asFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const parseDashboardRow = (value) => {
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
    if (unread === null ||
        todo === null ||
        qc === null ||
        fail === null ||
        pr === null ||
        ws === null ||
        dep === null ||
        blocker === null) {
        return null;
    }
    return { unread, todo, qc, fail, pr, ws, dep, blocker };
};
const readProjectRow = (dashboardDataDir, code) => parseDashboardRow(readJsonFile(path.join(dashboardDataDir, 'projects', `${code}.json`)));
const parseLoad = (value) => {
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
const readMachineStatus = (dashboardDataDir) => {
    const value = readJsonFile(path.join(dashboardDataDir, 'machine-status.json'));
    if (!isRecord(value)) {
        return null;
    }
    const cycleMinutesRaw = value.cycleMinutes;
    const cycleMinutes = cycleMinutesRaw === null ? null : asFiniteNumber(cycleMinutesRaw);
    return {
        memPct: asFiniteNumber(value.memPct),
        cpuPct: asFiniteNumber(value.cpuPct),
        diskPct: asFiniteNumber(value.diskPct),
        load: parseLoad(value.load),
        cycleMinutes,
    };
};
const isTokenColor = (value) => value === 'G' || value === 'Y' || value === 'K';
const asTokenColor = (value) => isTokenColor(value) ? value : 'Y';
const asNullableNumber = (value) => value === null ? null : asFiniteNumber(value);
const asCount = (value) => {
    const number = asFiniteNumber(value);
    return number === null ? 0 : number;
};
const parseTokenStatus = (value) => {
    if (!isRecord(value) || typeof value.name !== 'string') {
        return null;
    }
    return {
        name: value.name,
        fiveHourUtilizationPercent: asNullableNumber(value.fiveHourUtilizationPercent),
        fiveHourResetSeconds: asNullableNumber(value.fiveHourResetSeconds),
        sevenDayUtilizationPercent: asNullableNumber(value.sevenDayUtilizationPercent),
        sevenDayResetSeconds: asNullableNumber(value.sevenDayResetSeconds),
        color: asTokenColor(value.color),
        prep: asCount(value.prep),
        hum: asCount(value.hum),
    };
};
const readTokenStatuses = (dashboardDataDir) => {
    const value = readJsonFile(path.join(dashboardDataDir, 'token-status.json'));
    if (!isRecord(value) || !Array.isArray(value.tokens)) {
        return [];
    }
    const tokens = [];
    for (const entry of value.tokens) {
        const token = parseTokenStatus(entry);
        if (token !== null) {
            tokens.push(token);
        }
    }
    return tokens;
};
const buildComposeDashboardInput = (options) => {
    const projects = options.projectCodes.map((code) => ({
        code,
        row: readProjectRow(options.dashboardDataDir, code),
    }));
    return {
        projects,
        machineStatus: readMachineStatus(options.dashboardDataDir),
        tokens: readTokenStatuses(options.dashboardDataDir),
    };
};
exports.buildComposeDashboardInput = buildComposeDashboardInput;
const isExistingFile = (filePath) => {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch {
        return false;
    }
};
const dashboardComposeFilesPresent = (options) => {
    if (options.projectCodes.length === 0) {
        return false;
    }
    const requiredFiles = [
        path.join(options.dashboardDataDir, 'machine-status.json'),
        path.join(options.dashboardDataDir, 'token-status.json'),
        ...options.projectCodes.map((code) => path.join(options.dashboardDataDir, 'projects', `${code}.json`)),
    ];
    return requiredFiles.every((filePath) => isExistingFile(filePath));
};
exports.dashboardComposeFilesPresent = dashboardComposeFilesPresent;
const composeDashboardText = (options) => new ComposeDashboardUseCase_1.ComposeDashboardUseCase().run((0, exports.buildComposeDashboardInput)(options));
exports.composeDashboardText = composeDashboardText;
//# sourceMappingURL=dashboardComposeService.js.map