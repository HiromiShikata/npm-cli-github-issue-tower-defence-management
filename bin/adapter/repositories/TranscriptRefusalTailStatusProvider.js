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
exports.TranscriptRefusalTailStatusProvider = void 0;
const fs = __importStar(require("fs"));
const isRecord = (value) => typeof value === 'object' && value !== null;
const readString = (value, key) => {
    const candidate = value[key];
    return typeof candidate === 'string' ? candidate : null;
};
// A model refusal is durably recorded in the session transcript JSONL as an
// assistant entry whose stop reason is `refusal` (a system entry with
// `subtype: 'model_refusal_no_fallback'` precedes it). The stop reason lives
// on the embedded API message (`message.stop_reason`); the top-level field is
// also checked for robustness against transcript format variations.
const isRefusalAssistantEntry = (parsed) => {
    if (readString(parsed, 'type') !== 'assistant') {
        return false;
    }
    if (readString(parsed, 'stop_reason') === 'refusal') {
        return true;
    }
    const message = parsed.message;
    return isRecord(message) && readString(message, 'stop_reason') === 'refusal';
};
class TranscriptRefusalTailStatusProvider {
    constructor() {
        // A session is refusal-tailed when the most recent assistant entry in its
        // transcript is a model refusal. Sending a reminder to such a session is
        // guaranteed to burn a full-context API call and produce another refusal,
        // so the monitor excludes it from reminder candidates. The gate is purely
        // state-based: as soon as any non-refusal assistant entry appears after the
        // refusal (manual nudge, restart, compaction), the session is no longer
        // refusal-tailed and reminders resume.
        this.listRefusalTailedSessionNames = async (transcriptPathBySessionName) => {
            const refusalTailedSessionNames = new Set();
            for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
                if (this.isTranscriptRefusalTailed(transcriptPath)) {
                    refusalTailedSessionNames.add(sessionName);
                }
            }
            return refusalTailedSessionNames;
        };
        this.isTranscriptRefusalTailed = (transcriptPath) => {
            let content;
            try {
                content = fs.readFileSync(transcriptPath, 'utf8');
            }
            catch {
                return false;
            }
            let lastAssistantEntryIsRefusal = false;
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
                lastAssistantEntryIsRefusal = isRefusalAssistantEntry(parsed);
            }
            return lastAssistantEntryIsRefusal;
        };
    }
}
exports.TranscriptRefusalTailStatusProvider = TranscriptRefusalTailStatusProvider;
//# sourceMappingURL=TranscriptRefusalTailStatusProvider.js.map