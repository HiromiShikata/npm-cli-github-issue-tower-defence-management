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
exports.FileSystemSilentSessionNotifiedStateRepository = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const defaultStateFilePath = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'silent-session-notified.json');
};
// Persists the fire-once latch: the set of session names that have already
// received the current silent-episode reminder. The use case re-writes the
// full latch each cycle with the current timestamp, keeping a session latched
// for as long as it stays a reminder candidate (a continuous silent episode
// produces exactly one reminder), and prunes a session the moment it stops
// being a candidate so a later re-qualification fires again. The save
// intentionally OVERWRITES rather than merges: the use case supplies the
// complete latch to persist, so a pruned session must not linger.
class FileSystemSilentSessionNotifiedStateRepository {
    constructor(stateFilePath = defaultStateFilePath()) {
        this.stateFilePath = stateFilePath;
        this.loadRecentNotifiedSessionNames = async (params) => {
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const oldestAllowedEpochSeconds = nowEpochSeconds - params.recencyWindowSeconds;
            const recentSessionNames = new Set();
            for (const entry of this.readNotifiedEntries()) {
                if (entry.recordedEpochSeconds >= oldestAllowedEpochSeconds) {
                    recentSessionNames.add(entry.sessionName);
                }
            }
            return recentSessionNames;
        };
        this.saveNotifiedSessionNames = async (params) => {
            const recordedEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const notifiedBySessionName = new Map();
            for (const sessionName of params.sessionNames) {
                notifiedBySessionName.set(sessionName, {
                    sessionName,
                    recordedEpochSeconds,
                });
            }
            this.writeState(Array.from(notifiedBySessionName.values()));
        };
        this.readNotifiedEntries = () => {
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
            const storedEntries = parsed.notified;
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
        this.writeState = (notified) => {
            const directory = path.dirname(this.stateFilePath);
            fs.mkdirSync(directory, { recursive: true });
            const temporaryPath = `${this.stateFilePath}.${process.pid}.tmp`;
            fs.writeFileSync(temporaryPath, JSON.stringify({ notified }));
            fs.renameSync(temporaryPath, this.stateFilePath);
        };
    }
}
exports.FileSystemSilentSessionNotifiedStateRepository = FileSystemSilentSessionNotifiedStateRepository;
//# sourceMappingURL=FileSystemSilentSessionNotifiedStateRepository.js.map