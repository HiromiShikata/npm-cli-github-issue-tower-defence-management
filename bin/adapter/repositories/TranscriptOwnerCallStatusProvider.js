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
const path = __importStar(require("path"));
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
const hasOwnerTextReply = (content) => {
    if (typeof content === 'string') {
        return content.length > 0;
    }
    if (!Array.isArray(content)) {
        return false;
    }
    return content.some((block) => isRecord(block) && block.type === 'text');
};
class TranscriptOwnerCallStatusProvider {
    constructor(rootDirectory, ownerCallMarker) {
        this.rootDirectory = rootDirectory;
        this.ownerCallMarker = ownerCallMarker;
        this.listSessionNamesWithUnansweredOwnerCall = async (sessionNames) => {
            const waiting = new Set();
            if (this.rootDirectory === null ||
                this.ownerCallMarker === null ||
                this.ownerCallMarker.length === 0) {
                return waiting;
            }
            for (const sessionName of sessionNames) {
                if (this.isWaitingForOwnerReply(sessionName, this.ownerCallMarker)) {
                    waiting.add(sessionName);
                }
            }
            return waiting;
        };
        this.isWaitingForOwnerReply = (sessionName, marker) => {
            if (this.rootDirectory === null) {
                return false;
            }
            const filePath = path.join(this.rootDirectory, this.toTranscriptFileName(sessionName));
            let content;
            try {
                content = fs.readFileSync(filePath, 'utf8');
            }
            catch {
                return false;
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
                if (type === 'user' && hasOwnerTextReply(messageContent)) {
                    lastOwnerReplyEpochMs = epochMs;
                }
            }
            if (lastOwnerCallEpochMs === null) {
                return false;
            }
            return (lastOwnerReplyEpochMs === null ||
                lastOwnerCallEpochMs > lastOwnerReplyEpochMs);
        };
        this.toTranscriptFileName = (sessionName) => `${sessionName.replace(/\//g, '_')}.jsonl`;
    }
}
exports.TranscriptOwnerCallStatusProvider = TranscriptOwnerCallStatusProvider;
//# sourceMappingURL=TranscriptOwnerCallStatusProvider.js.map