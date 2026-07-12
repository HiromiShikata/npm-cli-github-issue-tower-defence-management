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
exports.FileSystemSilentSessionCandidateStateRepository = exports.ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS = exports.DEFAULT_STATE_RETENTION_WINDOW_SECONDS = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
exports.DEFAULT_STATE_RETENTION_WINDOW_SECONDS = 60 * 60;
exports.ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS = 24 * 60 * 60;
const defaultStateFilePath = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'silent-session-candidates.json');
};
class FileSystemSilentSessionCandidateStateRepository {
    constructor(stateFilePath = defaultStateFilePath(), retentionWindowSeconds = exports.DEFAULT_STATE_RETENTION_WINDOW_SECONDS) {
        this.stateFilePath = stateFilePath;
        this.retentionWindowSeconds = retentionWindowSeconds;
        this.loadRecentCandidateSessionNames = async (params) => {
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const oldestAllowedEpochSeconds = nowEpochSeconds - params.recencyWindowSeconds;
            const entries = this.readCandidateEntries();
            const recentSessionNames = new Set();
            for (const entry of entries) {
                if (entry.recordedEpochSeconds >= oldestAllowedEpochSeconds) {
                    recentSessionNames.add(entry.sessionName);
                }
            }
            return recentSessionNames;
        };
        this.saveCandidateSessionNames = async (params) => {
            const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const oldestRetainedEpochSeconds = recordedEpochSeconds - this.retentionWindowSeconds;
            const currentSessionNames = new Set(params.sessionNames);
            const mergedBySessionName = new Map();
            for (const entry of this.readCandidateEntries()) {
                if (entry.recordedEpochSeconds >= oldestRetainedEpochSeconds &&
                    !currentSessionNames.has(entry.sessionName)) {
                    mergedBySessionName.set(entry.sessionName, entry);
                }
            }
            for (const sessionName of currentSessionNames) {
                mergedBySessionName.set(sessionName, {
                    sessionName,
                    recordedEpochSeconds,
                });
            }
            this.writeState(Array.from(mergedBySessionName.values()), this.readAnnouncedRunningEntries());
        };
        this.loadAnnouncedRunningSubAgentLabels = async (params) => {
            const entry = this.readAnnouncedRunningEntries().find((candidate) => candidate.sessionName === params.sessionName);
            return new Set(entry?.labels ?? []);
        };
        this.saveAnnouncedRunningSubAgentLabels = async (params) => {
            const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const oldestRetainedEpochSeconds = recordedEpochSeconds - exports.ANNOUNCED_RUNNING_RETENTION_WINDOW_SECONDS;
            const retainedEntries = this.readAnnouncedRunningEntries().filter((entry) => entry.sessionName !== params.sessionName &&
                entry.recordedEpochSeconds >= oldestRetainedEpochSeconds);
            if (params.labels.length > 0) {
                retainedEntries.push({
                    sessionName: params.sessionName,
                    labels: params.labels,
                    recordedEpochSeconds,
                });
            }
            this.writeState(this.readCandidateEntries(), retainedEntries);
        };
        this.readState = () => {
            let raw;
            try {
                raw = fs.readFileSync(this.stateFilePath, 'utf8');
            }
            catch {
                return {};
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return {};
            }
            if (!isRecord(parsed)) {
                return {};
            }
            return parsed;
        };
        this.readCandidateEntries = () => {
            const storedEntries = this.readState().candidates;
            if (!Array.isArray(storedEntries)) {
                return [];
            }
            const entries = [];
            for (const storedEntry of storedEntries) {
                if (!isRecord(storedEntry)) {
                    continue;
                }
                const sessionName = storedEntry.sessionName;
                const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
                if (typeof sessionName === 'string' &&
                    typeof recordedEpochSeconds === 'number' &&
                    Number.isFinite(recordedEpochSeconds)) {
                    entries.push({ sessionName, recordedEpochSeconds });
                }
            }
            return entries;
        };
        this.readAnnouncedRunningEntries = () => {
            const storedEntries = this.readState().announcedRunningSubAgents;
            if (!Array.isArray(storedEntries)) {
                return [];
            }
            const entries = [];
            for (const storedEntry of storedEntries) {
                if (!isRecord(storedEntry)) {
                    continue;
                }
                const sessionName = storedEntry.sessionName;
                const recordedEpochSeconds = storedEntry.recordedEpochSeconds;
                const storedLabels = storedEntry.labels;
                if (typeof sessionName !== 'string' ||
                    typeof recordedEpochSeconds !== 'number' ||
                    !Number.isFinite(recordedEpochSeconds) ||
                    !Array.isArray(storedLabels)) {
                    continue;
                }
                const labels = storedLabels.filter((label) => typeof label === 'string');
                if (labels.length !== storedLabels.length) {
                    continue;
                }
                entries.push({ sessionName, labels, recordedEpochSeconds });
            }
            return entries;
        };
        this.writeState = (candidates, announcedRunningSubAgents) => {
            const directory = path.dirname(this.stateFilePath);
            fs.mkdirSync(directory, { recursive: true });
            const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
            fs.writeFileSync(temporaryPath, JSON.stringify({ candidates, announcedRunningSubAgents }));
            fs.renameSync(temporaryPath, this.stateFilePath);
        };
    }
}
exports.FileSystemSilentSessionCandidateStateRepository = FileSystemSilentSessionCandidateStateRepository;
//# sourceMappingURL=FileSystemSilentSessionCandidateStateRepository.js.map