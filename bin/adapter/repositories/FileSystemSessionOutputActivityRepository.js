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
exports.FileSystemSessionOutputActivityRepository = void 0;
const fs = __importStar(require("fs"));
const isRecord = (value) => typeof value === 'object' && value !== null;
const readString = (value, key) => {
    const candidate = value[key];
    return typeof candidate === 'string' ? candidate : null;
};
const parseEpochMilliseconds = (timestamp) => {
    if (timestamp === null) {
        return null;
    }
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : parsed;
};
/**
 * Reads the last main-session output time for each live session from its
 * already-resolved transcript path. Idle time is computed from the timestamp of
 * the latest `assistant` entry rather than from the transcript file modification
 * time, so a transcript touched only by tool results or owner replies still
 * counts as silent.
 */
class FileSystemSessionOutputActivityRepository {
    constructor() {
        this.listSessionOutputActivities = async (transcriptPathBySessionName) => {
            const activities = [];
            for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
                const lastOutputEpochSeconds = this.readLastAssistantOutputEpochSeconds(transcriptPath);
                if (lastOutputEpochSeconds !== null) {
                    activities.push({ sessionName, lastOutputEpochSeconds });
                }
            }
            return activities;
        };
        this.readLastAssistantOutputEpochSeconds = (transcriptPath) => {
            let content;
            try {
                content = fs.readFileSync(transcriptPath, 'utf8');
            }
            catch {
                return null;
            }
            let lastAssistantEpochMs = null;
            for (const line of content.split('\n')) {
                const trimmed = line.trim();
                if (trimmed.length === 0) {
                    continue;
                }
                let parsed;
                try {
                    parsed = JSON.parse(trimmed);
                }
                catch {
                    continue;
                }
                if (!isRecord(parsed)) {
                    continue;
                }
                if (readString(parsed, 'type') !== 'assistant') {
                    continue;
                }
                const epochMs = parseEpochMilliseconds(readString(parsed, 'timestamp'));
                if (epochMs === null) {
                    continue;
                }
                if (lastAssistantEpochMs === null || epochMs > lastAssistantEpochMs) {
                    lastAssistantEpochMs = epochMs;
                }
            }
            if (lastAssistantEpochMs === null) {
                return null;
            }
            return Math.floor(lastAssistantEpochMs / 1000);
        };
    }
}
exports.FileSystemSessionOutputActivityRepository = FileSystemSessionOutputActivityRepository;
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.js.map