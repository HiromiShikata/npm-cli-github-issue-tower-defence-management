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
exports.TranscriptSessionSubAgentActivityRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const isRecord = (value) => typeof value === 'object' && value !== null;
const readString = (value, key) => {
    const candidate = value[key];
    return typeof candidate === 'string' ? candidate : null;
};
const parseEpochSeconds = (timestamp) => {
    if (timestamp === null) {
        return null;
    }
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};
const parseTranscript = (content) => {
    let firstEntryEpochSeconds = null;
    let lastStopReason = null;
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
        const epochSeconds = parseEpochSeconds(readString(parsed, 'timestamp'));
        if (firstEntryEpochSeconds === null && epochSeconds !== null) {
            firstEntryEpochSeconds = epochSeconds;
        }
        const message = parsed.message;
        if (isRecord(message)) {
            const stopReason = readString(message, 'stop_reason');
            if (stopReason !== null) {
                lastStopReason = stopReason;
            }
        }
    }
    return { firstEntryEpochSeconds, lastStopReason };
};
const clampToZero = (value) => (value > 0 ? value : 0);
class TranscriptSessionSubAgentActivityRepository {
    constructor(directoryResolver, now) {
        this.directoryResolver = directoryResolver;
        this.now = now;
        this.listSubAgentActivitiesBySessionName = async (sessionNames) => {
            const result = new Map();
            const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
            for (const sessionName of sessionNames) {
                const directory = this.directoryResolver.resolveSubAgentsDirectory(sessionName);
                if (directory === null) {
                    continue;
                }
                const activities = this.collectActivities(directory, nowEpochSeconds);
                if (activities.length > 0) {
                    result.set(sessionName, activities);
                }
            }
            return result;
        };
        this.collectActivities = (directory, nowEpochSeconds) => {
            let entries;
            try {
                entries = fs.readdirSync(directory, { withFileTypes: true });
            }
            catch {
                return [];
            }
            const activities = [];
            for (const entry of entries) {
                const fileName = entry.name;
                if (!fileName.startsWith('agent-') || !fileName.endsWith('.jsonl')) {
                    continue;
                }
                const filePath = path.join(directory, fileName);
                const activity = this.toActivity(filePath, fileName, nowEpochSeconds);
                if (activity !== null) {
                    activities.push(activity);
                }
            }
            return activities;
        };
        this.toActivity = (filePath, fileName, nowEpochSeconds) => {
            let content;
            let stats;
            try {
                content = fs.readFileSync(filePath, 'utf8');
                stats = fs.statSync(filePath);
            }
            catch {
                return null;
            }
            const transcript = parseTranscript(content);
            if (transcript.lastStopReason === 'end_turn') {
                return null;
            }
            const silentSeconds = clampToZero(nowEpochSeconds - Math.floor(stats.mtimeMs / 1000));
            const runningSeconds = transcript.firstEntryEpochSeconds === null
                ? 0
                : clampToZero(nowEpochSeconds - transcript.firstEntryEpochSeconds);
            return {
                label: fileName.replace(/\.jsonl$/, ''),
                silentSeconds,
                runningSeconds,
            };
        };
    }
}
exports.TranscriptSessionSubAgentActivityRepository = TranscriptSessionSubAgentActivityRepository;
//# sourceMappingURL=TranscriptSessionSubAgentActivityRepository.js.map