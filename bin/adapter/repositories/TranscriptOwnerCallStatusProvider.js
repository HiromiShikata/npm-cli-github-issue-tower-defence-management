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
exports.TranscriptOwnerCallStatusProvider = void 0;
const fs = __importStar(require("fs"));
const silentSessionReminderSentinel_1 = require("../../domain/usecases/silentSessionReminderSentinel");
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
const extractText = (content) => {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    const texts = [];
    for (const block of content) {
        if (isRecord(block) && block.type === 'text') {
            const text = readString(block, 'text');
            if (text !== null) {
                texts.push(text);
            }
        }
    }
    return texts.join('\n');
};
// A transcript user entry is only a genuine owner reply when it was actually
// typed (or queued) by the human owner. Claude Code records the provenance of
// each user entry on the top-level `origin` and `promptSource` fields. A
// genuine human prompt is identified by EITHER `origin.kind === 'human'` OR a
// `promptSource` of `typed`/`queued`; the second condition is required because
// older-format transcripts record genuine human replies with a `promptSource`
// of `queued`/`typed` but no `origin` field, and dropping those would leave a
// real owner reply uncounted and the session waiting forever. Every
// system-injected user entry, by contrast, uses a `promptSource` of `system`
// (sub-agent `task-notification` notices, cross-session `peer` messages) or
// `sdk` (spawn prompts), or has neither field (tool results, skill/meta
// entries) — none of which match. Only a genuine human entry may clear an
// outstanding call-to-user; otherwise a system-injected entry would be
// miscounted as the owner answering and a genuinely waiting session would stop
// being suppressed.
const isGenuineHumanEntry = (parsed) => {
    const origin = parsed.origin;
    if (isRecord(origin) && readString(origin, 'kind') === 'human') {
        return true;
    }
    const promptSource = readString(parsed, 'promptSource');
    return promptSource === 'typed' || promptSource === 'queued';
};
const hasOwnerTextReply = (content) => {
    if (typeof content === 'string') {
        if (content.length === 0) {
            return false;
        }
        // A monitor-injected self-check reminder lands in the target session's
        // transcript as a user text entry. It carries the reminder sentinel, so it
        // is the monitor talking to the session, not the owner replying. It MUST NOT
        // advance the last-owner-reply time, otherwise an outstanding call-to-user
        // is wrongly treated as answered and the session stops being suppressed.
        return !content.includes(silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL);
    }
    if (!Array.isArray(content)) {
        return false;
    }
    const hasTextBlock = content.some((block) => isRecord(block) && block.type === 'text');
    if (!hasTextBlock) {
        return false;
    }
    return !extractText(content).includes(silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL);
};
class TranscriptOwnerCallStatusProvider {
    constructor(ownerCallMarker) {
        this.ownerCallMarker = ownerCallMarker;
        this.listUnansweredOwnerCallEpochSecondsBySessionName = async (transcriptPathBySessionName) => {
            const unansweredOwnerCallEpochSecondsBySessionName = new Map();
            if (this.ownerCallMarker === null || this.ownerCallMarker.length === 0) {
                return unansweredOwnerCallEpochSecondsBySessionName;
            }
            const marker = this.ownerCallMarker;
            for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
                const unansweredOwnerCallEpochMs = this.findUnansweredOwnerCallEpochMs(transcriptPath, marker);
                if (unansweredOwnerCallEpochMs !== null) {
                    unansweredOwnerCallEpochSecondsBySessionName.set(sessionName, Math.floor(unansweredOwnerCallEpochMs / 1000));
                }
            }
            return unansweredOwnerCallEpochSecondsBySessionName;
        };
        this.findUnansweredOwnerCallEpochMs = (transcriptPath, marker) => {
            let content;
            try {
                content = fs.readFileSync(transcriptPath, 'utf8');
            }
            catch {
                return null;
            }
            let lastOwnerCallEpochMs = null;
            let lastOwnerReplyEpochMs = null;
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
                const epochMs = parseEpochMilliseconds(readString(parsed, 'timestamp'));
                if (epochMs === null) {
                    continue;
                }
                const type = readString(parsed, 'type');
                const message = parsed.message;
                const messageContent = isRecord(message) ? message.content : null;
                if (type === 'assistant' &&
                    extractText(messageContent).includes(marker)) {
                    lastOwnerCallEpochMs = epochMs;
                }
                if (type === 'user' &&
                    isGenuineHumanEntry(parsed) &&
                    hasOwnerTextReply(messageContent)) {
                    lastOwnerReplyEpochMs = epochMs;
                }
            }
            if (lastOwnerCallEpochMs === null) {
                return null;
            }
            return lastOwnerReplyEpochMs === null ||
                lastOwnerCallEpochMs > lastOwnerReplyEpochMs
                ? lastOwnerCallEpochMs
                : null;
        };
    }
}
exports.TranscriptOwnerCallStatusProvider = TranscriptOwnerCallStatusProvider;
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.js.map