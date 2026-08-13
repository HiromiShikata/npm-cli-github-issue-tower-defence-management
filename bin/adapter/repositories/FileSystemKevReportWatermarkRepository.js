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
exports.FileSystemKevReportWatermarkRepository = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const errorCode = (error) => {
    if (!isRecord(error)) {
        return null;
    }
    const code = error.code;
    return typeof code === 'string' ? code : null;
};
const isCalendarYmd = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (!Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value);
};
const defaultStateFilePath = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'kev-report-watermark.json');
};
class FileSystemKevReportWatermarkRepository {
    constructor(stateFilePath = defaultStateFilePath()) {
        this.stateFilePath = stateFilePath;
        this.load = async () => {
            let raw;
            try {
                raw = fs.readFileSync(this.stateFilePath, 'utf8');
            }
            catch (error) {
                if (errorCode(error) === 'ENOENT') {
                    return { type: 'absent' };
                }
                return this.unreadable(`the stored watermark file could not be read (${String(error)})`);
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch (error) {
                return this.unreadable(`the stored watermark file does not contain valid JSON (${String(error)})`);
            }
            if (!isRecord(parsed)) {
                return this.unreadable('the stored watermark file does not contain a JSON object');
            }
            const lastReportedDateAdded = parsed.lastReportedDateAdded;
            if (typeof lastReportedDateAdded !== 'string') {
                return this.unreadable(`the stored lastReportedDateAdded is not a string (${JSON.stringify(lastReportedDateAdded)})`);
            }
            if (!isCalendarYmd(lastReportedDateAdded)) {
                return this.unreadable(`the stored lastReportedDateAdded is not a calendar date in YYYY-MM-DD form (${JSON.stringify(lastReportedDateAdded)})`);
            }
            const reportedCveIdsOnLastReportedDateAdded = parsed.reportedCveIdsOnLastReportedDateAdded;
            if (!Array.isArray(reportedCveIdsOnLastReportedDateAdded)) {
                return this.unreadable('the stored reportedCveIdsOnLastReportedDateAdded is not an array');
            }
            if (!reportedCveIdsOnLastReportedDateAdded.every((cveId) => typeof cveId === 'string')) {
                return this.unreadable('the stored reportedCveIdsOnLastReportedDateAdded contains a non-string entry');
            }
            return {
                type: 'stored',
                watermark: {
                    lastReportedDateAdded,
                    reportedCveIdsOnLastReportedDateAdded: reportedCveIdsOnLastReportedDateAdded,
                },
            };
        };
        this.save = async (watermark) => {
            try {
                const directory = path.dirname(this.stateFilePath);
                fs.mkdirSync(directory, { recursive: true });
                const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
                fs.writeFileSync(temporaryPath, JSON.stringify(watermark));
                fs.renameSync(temporaryPath, this.stateFilePath);
            }
            catch (error) {
                console.error(`Unable to write the KEV report watermark to ${this.stateFilePath}: ${String(error)}`);
                throw error;
            }
        };
        this.unreadable = (reason) => {
            console.error(`Unable to use the KEV report watermark stored at ${this.stateFilePath}: ${reason}. The file is left untouched for inspection.`);
            return { type: 'unreadable', reason };
        };
    }
}
exports.FileSystemKevReportWatermarkRepository = FileSystemKevReportWatermarkRepository;
//# sourceMappingURL=FileSystemKevReportWatermarkRepository.js.map