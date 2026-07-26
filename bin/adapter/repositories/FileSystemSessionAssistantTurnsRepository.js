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
exports.FileSystemSessionAssistantTurnsRepository = exports.DEFAULT_TRANSCRIPT_TAIL_BYTES = void 0;
const fs = __importStar(require("fs"));
exports.DEFAULT_TRANSCRIPT_TAIL_BYTES = 3000000;
const isRecord = (value) => typeof value === 'object' && value !== null;
const assistantText = (message) => {
    const content = message.content;
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        const parts = [];
        for (const block of content) {
            if (isRecord(block) &&
                block.type === 'text' &&
                typeof block.text === 'string') {
                parts.push(block.text);
            }
        }
        return parts.join(' ');
    }
    return '';
};
class FileSystemSessionAssistantTurnsRepository {
    constructor(tailBytes = exports.DEFAULT_TRANSCRIPT_TAIL_BYTES) {
        this.tailBytes = tailBytes;
        this.listRecentAssistantTurnsBySessionName = async (transcriptPathBySessionName, maxTurnsPerSession) => {
            const turnsBySessionName = new Map();
            for (const [sessionName, transcriptPath] of transcriptPathBySessionName) {
                const turns = this.readRecentAssistantTurns(transcriptPath, maxTurnsPerSession);
                if (turns.length > 0) {
                    turnsBySessionName.set(sessionName, turns);
                }
            }
            return turnsBySessionName;
        };
        this.readRecentAssistantTurns = (transcriptPath, maxTurns) => {
            const lines = this.readTailLines(transcriptPath);
            const turns = [];
            for (let index = lines.length - 1; index >= 0; index -= 1) {
                const trimmed = lines[index].trim();
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
                if (!isRecord(parsed) || parsed.type !== 'assistant') {
                    continue;
                }
                const message = parsed.message;
                if (!isRecord(message)) {
                    continue;
                }
                const text = assistantText(message);
                if (text.trim().length === 0) {
                    continue;
                }
                turns.push(text);
                if (turns.length >= maxTurns) {
                    break;
                }
            }
            return turns;
        };
        this.readTailLines = (transcriptPath) => {
            let handle;
            try {
                handle = fs.openSync(transcriptPath, 'r');
            }
            catch {
                return [];
            }
            try {
                const size = fs.fstatSync(handle).size;
                const start = size > this.tailBytes ? size - this.tailBytes : 0;
                const length = size - start;
                const buffer = new Uint8Array(length);
                fs.readSync(handle, buffer, 0, length, start);
                let text = Buffer.from(buffer).toString('utf8');
                if (start > 0) {
                    const newlineIndex = text.indexOf('\n');
                    text = newlineIndex === -1 ? '' : text.slice(newlineIndex + 1);
                }
                return text.split('\n');
            }
            catch {
                return [];
            }
            finally {
                fs.closeSync(handle);
            }
        };
    }
}
exports.FileSystemSessionAssistantTurnsRepository = FileSystemSessionAssistantTurnsRepository;
//# sourceMappingURL=FileSystemSessionAssistantTurnsRepository.js.map