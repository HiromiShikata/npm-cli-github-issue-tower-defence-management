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
exports.FileSystemSilentSessionHubTaskStatusCacheRepository = exports.defaultSilentSessionHubTaskStatusCacheFilePath = exports.DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const localStorageCacheDirectory_1 = require("./localStorageCacheDirectory");
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isIssueState = (value) => value === 'OPEN' || value === 'CLOSED' || value === 'MERGED';
exports.DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS = 60 * 60;
const defaultSilentSessionHubTaskStatusCacheFilePath = () => path.join((0, localStorageCacheDirectory_1.tdpmCacheDirectory)(), 'silent-session-hub-task-status.json');
exports.defaultSilentSessionHubTaskStatusCacheFilePath = defaultSilentSessionHubTaskStatusCacheFilePath;
class FileSystemSilentSessionHubTaskStatusCacheRepository {
    constructor(stateFilePath = (0, exports.defaultSilentSessionHubTaskStatusCacheFilePath)(), retentionWindowSeconds = exports.DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS) {
        this.stateFilePath = stateFilePath;
        this.retentionWindowSeconds = retentionWindowSeconds;
        this.loadHubTaskStatus = async (params) => {
            for (const entry of this.readEntries()) {
                if (entry.url === params.url) {
                    return entry;
                }
            }
            return null;
        };
        this.saveHubTaskStatus = async (params) => {
            const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const oldestRetainedEpochSeconds = recordedEpochSeconds - this.retentionWindowSeconds;
            const mergedByUrl = new Map();
            for (const entry of this.readEntries()) {
                if (entry.recordedEpochSeconds >= oldestRetainedEpochSeconds &&
                    entry.url !== params.url) {
                    mergedByUrl.set(entry.url, entry);
                }
            }
            mergedByUrl.set(params.url, {
                url: params.url,
                state: params.state,
                status: params.status,
                recordedEpochSeconds,
            });
            this.writeEntries(Array.from(mergedByUrl.values()));
        };
        this.readEntries = () => {
            let raw;
            try {
                raw = fs.readFileSync(this.stateFilePath, 'utf8');
            }
            catch {
                return [];
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return [];
            }
            if (!isRecord(parsed)) {
                return [];
            }
            const storedEntries = parsed.hubTaskStatuses;
            if (!Array.isArray(storedEntries)) {
                return [];
            }
            const entries = [];
            for (const storedEntry of storedEntries) {
                if (!isRecord(storedEntry)) {
                    continue;
                }
                const url = storedEntry.url;
                const state = storedEntry.state;
                const status = storedEntry.status;
                const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
                if (typeof url === 'string' &&
                    isIssueState(state) &&
                    (typeof status === 'string' || status === null) &&
                    typeof recordedEpochSeconds === 'number' &&
                    Number.isFinite(recordedEpochSeconds)) {
                    entries.push({ url, state, status, recordedEpochSeconds });
                }
            }
            return entries;
        };
        this.writeEntries = (entries) => {
            const directory = path.dirname(this.stateFilePath);
            fs.mkdirSync(directory, { recursive: true });
            const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
            fs.writeFileSync(temporaryPath, JSON.stringify({ hubTaskStatuses: entries }));
            fs.renameSync(temporaryPath, this.stateFilePath);
        };
    }
}
exports.FileSystemSilentSessionHubTaskStatusCacheRepository = FileSystemSilentSessionHubTaskStatusCacheRepository;
//# sourceMappingURL=FileSystemSilentSessionHubTaskStatusCacheRepository.js.map