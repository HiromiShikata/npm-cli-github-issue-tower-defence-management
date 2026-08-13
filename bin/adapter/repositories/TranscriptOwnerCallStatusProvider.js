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
exports.TranscriptOwnerCallStatusProvider = exports.ownerCallMarkerFamilyResolve = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
const OWNER_CALL_TAG_TERMINATOR = '>';
const OWNER_CALL_CANDIDATE_TAG_INFIX = '-pending';
const OWNER_CALL_CANDIDATE_TAG_SUFFIX = `${OWNER_CALL_CANDIDATE_TAG_INFIX}${OWNER_CALL_TAG_TERMINATOR}`;
const ownerCallMarkerFamilyResolve = (marker) => marker.endsWith(OWNER_CALL_TAG_TERMINATOR)
    ? [
        marker,
        `${marker.slice(0, -OWNER_CALL_TAG_TERMINATOR.length)}${OWNER_CALL_CANDIDATE_TAG_SUFFIX}`,
    ]
    : [marker];
exports.ownerCallMarkerFamilyResolve = ownerCallMarkerFamilyResolve;
// A reply the owner types while the agent is still working is NOT written as a `user` entry: the
// running turn consumes it from the queue, and the transcript keeps only
// {"type":"queue-operation","operation":"enqueue","content":"<the text>"} plus its `remove` twin.
// Reading `user` entries alone therefore misses every mid-turn reply, leaves the call outstanding
// for the rest of the session, and suppresses the stall reminder of a session the owner has
// already answered. The exclusions match the ones the status line applies to the same entries, so
// a system-injected enqueue never counts as an owner reply.
const INJECTED_ENQUEUE_CONTENT_MARKERS = [
    silentSessionReminderSentinel_1.SILENT_SESSION_REMINDER_SENTINEL,
    '<system-reminder>',
    'UserPromptSubmit hook',
    '<task-notification>',
    'SYSTEM NOTIFICATION',
    '<local-command-stdout>',
    '<local-command-caveat>',
    '<command-name>',
    'This session is being continued from a previous conversation',
];
const isOwnerEnqueuedReply = (parsed) => {
    if (readString(parsed, 'operation') !== 'enqueue') {
        return false;
    }
    const content = readString(parsed, 'content');
    if (content === null || content.length === 0) {
        return false;
    }
    return !INJECTED_ENQUEUE_CONTENT_MARKERS.some((injectedMarker) => content.includes(injectedMarker));
};
const TRANSCRIPT_FILE_EXTENSION = '.jsonl';
const OWNER_REPLY_MARKER_FILE_EXTENSION = '.reply_ts';
const SUPPRESSED_OWNER_CALL_MARKER_FILE_EXTENSION = '.suppress_ts';
const APPROVED_OWNER_CALL_MARKER_FILE_EXTENSION = '.call_ts';
const EMITTED_OWNER_CALL_MARKER_FILE_EXTENSION = '.call_emitted';
const UNSAFE_SESSION_ID_CHARACTER_PATTERN = /[^A-Za-z0-9._-]/g;
const isCandidateOwnerCallMarker = (marker) => marker.endsWith(OWNER_CALL_CANDIDATE_TAG_SUFFIX);
class TranscriptOwnerCallStatusProvider {
    constructor(ownerCallMarker, ownerReplyMarkerDirectory = null) {
        this.ownerReplyMarkerDirectory = ownerReplyMarkerDirectory;
        this.listUnansweredOwnerCallEpochSecondsBySessionName = async (transcriptPathBySessionName) => {
            const unansweredOwnerCallEpochSecondsBySessionName = new Map();
            if (this.ownerCallMarkerFamily.length === 0) {
                return unansweredOwnerCallEpochSecondsBySessionName;
            }
            for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
                const unansweredOwnerCallEpochMs = this.findUnansweredOwnerCallEpochMs(transcriptPath, this.ownerCallMarkerFamily);
                if (unansweredOwnerCallEpochMs !== null) {
                    unansweredOwnerCallEpochSecondsBySessionName.set(sessionName, Math.floor(unansweredOwnerCallEpochMs / 1000));
                }
            }
            return unansweredOwnerCallEpochSecondsBySessionName;
        };
        this.findUnansweredOwnerCallEpochMs = (transcriptPath, markerFamily) => {
            let content;
            try {
                content = fs.readFileSync(transcriptPath, 'utf8');
            }
            catch {
                return null;
            }
            let lastOwnerCallEpochMs = null;
            let lastOwnerCallIsCandidateOnly = false;
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
                if (type === 'assistant') {
                    const assistantText = extractText(messageContent);
                    const matchedMarkers = markerFamily.filter((marker) => assistantText.includes(marker));
                    if (matchedMarkers.length > 0) {
                        lastOwnerCallEpochMs = epochMs;
                        lastOwnerCallIsCandidateOnly = matchedMarkers.every(isCandidateOwnerCallMarker);
                    }
                }
                if (type === 'user' &&
                    isGenuineHumanEntry(parsed) &&
                    hasOwnerTextReply(messageContent)) {
                    lastOwnerReplyEpochMs = epochMs;
                }
                if (type === 'queue-operation' && isOwnerEnqueuedReply(parsed)) {
                    lastOwnerReplyEpochMs =
                        lastOwnerReplyEpochMs === null || epochMs > lastOwnerReplyEpochMs
                            ? epochMs
                            : lastOwnerReplyEpochMs;
                }
            }
            if (lastOwnerCallEpochMs === null) {
                return null;
            }
            if (this.isCallSuppressedUndelivered(transcriptPath, lastOwnerCallEpochMs)) {
                return null;
            }
            if (lastOwnerCallIsCandidateOnly &&
                !this.isCandidateCallDelivered(transcriptPath, lastOwnerCallEpochMs)) {
                return null;
            }
            const markerReplyEpochMs = this.readOwnerReplyMarkerEpochMs(transcriptPath);
            const resolvedReplyEpochMs = markerReplyEpochMs !== null &&
                (lastOwnerReplyEpochMs === null ||
                    markerReplyEpochMs > lastOwnerReplyEpochMs)
                ? markerReplyEpochMs
                : lastOwnerReplyEpochMs;
            return resolvedReplyEpochMs === null ||
                lastOwnerCallEpochMs > resolvedReplyEpochMs
                ? lastOwnerCallEpochMs
                : null;
        };
        // The owner sees only the status line, so the reply time it renders is the value the owner
        // believes the fleet is acting on. The status line writes that value to a per-session marker
        // file, and reading it here keeps this decision and the owner's own view of it from diverging.
        // The transcript-derived value still stands on its own: an absent, unreadable, or older marker
        // changes nothing, so a fresh host with no markers yet behaves exactly as before.
        this.readOwnerReplyMarkerEpochMs = (transcriptPath) => this.readMarkerEpochMs(transcriptPath, OWNER_REPLY_MARKER_FILE_EXTENSION);
        // The format gate the owner's sessions run under can hold an owner call instead of delivering
        // it, and it records that decision beside the reply marker: the held call's timestamp in the
        // suppression marker, and the timestamp of any call it later approved in the approval marker. A
        // held call the approval marker does not name never reached the owner, so treating it as a wait
        // on the owner would silence the session's stall reminder for good — the session would keep its
        // task and never be woken again. Such a call is therefore not an outstanding owner call here. A
        // delivered call, and a newer call the suppression marker does not name, are untouched.
        this.isCallSuppressedUndelivered = (transcriptPath, ownerCallEpochMs) => {
            const suppressedEpochMs = this.readMarkerEpochMs(transcriptPath, SUPPRESSED_OWNER_CALL_MARKER_FILE_EXTENSION);
            if (suppressedEpochMs === null || suppressedEpochMs !== ownerCallEpochMs) {
                return false;
            }
            const approvedEpochMs = this.readMarkerEpochMs(transcriptPath, APPROVED_OWNER_CALL_MARKER_FILE_EXTENSION);
            return approvedEpochMs !== suppressedEpochMs;
        };
        this.isCandidateCallDelivered = (transcriptPath, ownerCallEpochMs) => {
            if (this.ownerReplyMarkerDirectory === null) {
                return true;
            }
            const emittedEpochMs = this.readMarkerEpochMs(transcriptPath, EMITTED_OWNER_CALL_MARKER_FILE_EXTENSION);
            if (emittedEpochMs === ownerCallEpochMs) {
                return true;
            }
            return (this.readMarkerEpochMs(transcriptPath, APPROVED_OWNER_CALL_MARKER_FILE_EXTENSION) === ownerCallEpochMs);
        };
        this.readMarkerEpochMs = (transcriptPath, markerFileExtension) => {
            if (this.ownerReplyMarkerDirectory === null) {
                return null;
            }
            const fileName = path.basename(transcriptPath);
            const sessionId = fileName.endsWith(TRANSCRIPT_FILE_EXTENSION)
                ? fileName.slice(0, -TRANSCRIPT_FILE_EXTENSION.length)
                : fileName;
            const safeSessionId = sessionId.replace(UNSAFE_SESSION_ID_CHARACTER_PATTERN, '_');
            let markerContent;
            try {
                markerContent = fs.readFileSync(path.join(this.ownerReplyMarkerDirectory, `${safeSessionId}${markerFileExtension}`), 'utf8');
            }
            catch {
                return null;
            }
            return parseEpochMilliseconds(markerContent.split('\n')[0].trim());
        };
        this.ownerCallMarkerFamily =
            ownerCallMarker === null || ownerCallMarker.length === 0
                ? []
                : (0, exports.ownerCallMarkerFamilyResolve)(ownerCallMarker);
    }
}
exports.TranscriptOwnerCallStatusProvider = TranscriptOwnerCallStatusProvider;
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.js.map