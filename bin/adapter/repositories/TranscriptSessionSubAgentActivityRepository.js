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
exports.TranscriptSessionSubAgentActivityRepository = exports.normalizeCommandFragment = void 0;
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
const PENDING_TOOL_COMMAND_FRAGMENT_LENGTH = 60;
const normalizeCommandFragment = (command) => command
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PENDING_TOOL_COMMAND_FRAGMENT_LENGTH);
exports.normalizeCommandFragment = normalizeCommandFragment;
const readContentBlocks = (message) => {
    const content = message.content;
    if (!Array.isArray(content)) {
        return [];
    }
    return content.filter(isRecord);
};
// Tool whose result marks the sub-agent's final structured answer: once its
// tool_result is recorded, the sub-agent has delivered its output and is
// genuinely complete even though the transcript tail is a user entry.
const COMPLETION_TOOL_NAMES = new Set(['StructuredOutput']);
// Tools that delegate work to a nested child sub-agent. A parent whose
// transcript tail is a pending tool_use of one of these tools is waiting for
// the child to run (possibly queued), produces no transcript writes of its
// own, and therefore looks "silent" by mtime alone. Such a parent is treated
// as waiting on an external process so it is excluded from both the
// sub-agent-idle and sub-agent-long-running selections.
const DELEGATION_TOOL_NAMES = new Set(['Agent', 'Task']);
const entryToolUseNames = (message) => readContentBlocks(message)
    .filter((block) => readString(block, 'type') === 'tool_use')
    .map((block) => readString(block, 'name'))
    .filter((name) => name !== null);
const entryIndicatesCompletion = (entry, precedingAssistantToolUseNames) => {
    const type = readString(entry, 'type');
    const message = entry.message;
    if (!isRecord(message)) {
        return false;
    }
    if (type === 'assistant') {
        const stopReason = readString(message, 'stop_reason');
        if (stopReason === 'end_turn' || stopReason === 'stop_sequence') {
            return true;
        }
        const blocks = readContentBlocks(message);
        const lastBlock = blocks[blocks.length - 1];
        return lastBlock !== undefined && readString(lastBlock, 'type') === 'text';
    }
    if (type === 'user') {
        const blocks = readContentBlocks(message);
        if (blocks.length === 0) {
            return true;
        }
        const lastBlock = blocks[blocks.length - 1];
        const lastBlockType = readString(lastBlock, 'type');
        if (lastBlockType === 'text') {
            // A trailing user text entry is an interruption (e.g. "[Request
            // interrupted by user]"): the sub-agent will not produce further
            // output, so the transcript is terminal.
            return true;
        }
        if (lastBlockType === 'tool_result') {
            // A trailing tool_result is an IN-FLIGHT state, not completion: the
            // sub-agent has just received a tool result and the next assistant
            // turn is being generated. Treating it as completion made an active
            // agent flap in and out of the activity snapshot between samples
            // (tail alternates between pending tool_use and tool_result). Only
            // the result of an explicit completion tool (see
            // COMPLETION_TOOL_NAMES) is a genuine terminal state, so completed
            // agents still drop out of the snapshot.
            return precedingAssistantToolUseNames.some((name) => COMPLETION_TOOL_NAMES.has(name));
        }
        return false;
    }
    return false;
};
const entryPendingToolCommands = (entry) => {
    const type = readString(entry, 'type');
    const message = entry.message;
    if (type !== 'assistant' || !isRecord(message)) {
        return [];
    }
    const commands = [];
    for (const block of readContentBlocks(message)) {
        if (readString(block, 'type') !== 'tool_use') {
            continue;
        }
        const input = block.input;
        if (!isRecord(input)) {
            continue;
        }
        const command = readString(input, 'command');
        if (command !== null && command.trim().length > 0) {
            commands.push(command);
        }
    }
    return commands;
};
const parseTranscript = (content) => {
    let firstEntryEpochSeconds = null;
    let lastEntryIndicatesCompletion = false;
    let pendingToolCommands = [];
    let pendingDelegationToolUse = false;
    let precedingAssistantToolUseNames = [];
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
        if (isRecord(parsed.message)) {
            lastEntryIndicatesCompletion = entryIndicatesCompletion(parsed, precedingAssistantToolUseNames);
            pendingToolCommands = entryPendingToolCommands(parsed);
            if (readString(parsed, 'type') === 'assistant') {
                precedingAssistantToolUseNames = entryToolUseNames(parsed.message);
                pendingDelegationToolUse = precedingAssistantToolUseNames.some((name) => DELEGATION_TOOL_NAMES.has(name));
            }
            else {
                pendingDelegationToolUse = false;
            }
        }
    }
    return {
        firstEntryEpochSeconds,
        lastEntryIndicatesCompletion,
        pendingToolCommands,
        pendingDelegationToolUse,
    };
};
const clampToZero = (value) => (value > 0 ? value : 0);
class TranscriptSessionSubAgentActivityRepository {
    constructor(directoryResolver, processLister, now) {
        this.directoryResolver = directoryResolver;
        this.processLister = processLister;
        this.now = now;
        this.listSubAgentActivitiesBySessionName = async (sessionNames, transcriptPathBySessionName) => {
            const result = new Map();
            const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
            let normalizedProcessCommandLines = null;
            const loadNormalizedProcessCommandLines = async () => {
                if (normalizedProcessCommandLines === null) {
                    const processes = await this.processLister.listProcesses();
                    normalizedProcessCommandLines = processes.map((process) => process.commandLine.replace(/\s+/g, ' ').trim());
                }
                return normalizedProcessCommandLines;
            };
            for (const sessionName of sessionNames) {
                const mainTranscriptPath = transcriptPathBySessionName.get(sessionName) ?? null;
                const directory = this.directoryResolver.resolveSubAgentsDirectory(sessionName, mainTranscriptPath);
                if (directory === null) {
                    continue;
                }
                const activities = await this.collectActivities(directory, nowEpochSeconds, loadNormalizedProcessCommandLines);
                if (activities.length > 0) {
                    result.set(sessionName, activities);
                }
            }
            return result;
        };
        this.collectActivities = async (directory, nowEpochSeconds, loadNormalizedProcessCommandLines) => {
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
                const activity = await this.toActivity(filePath, fileName, nowEpochSeconds, loadNormalizedProcessCommandLines);
                if (activity !== null) {
                    activities.push(activity);
                }
            }
            return activities;
        };
        this.toActivity = async (filePath, fileName, nowEpochSeconds, loadNormalizedProcessCommandLines) => {
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
            if (transcript.lastEntryIndicatesCompletion) {
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
                waitingOnExternalProcess: transcript.pendingDelegationToolUse ||
                    (await this.hasLiveMatchingProcess(transcript.pendingToolCommands, loadNormalizedProcessCommandLines)),
            };
        };
        this.hasLiveMatchingProcess = async (pendingToolCommands, loadNormalizedProcessCommandLines) => {
            if (pendingToolCommands.length === 0) {
                return false;
            }
            const fragments = pendingToolCommands
                .map(exports.normalizeCommandFragment)
                .filter((fragment) => fragment.length > 0);
            if (fragments.length === 0) {
                return false;
            }
            const processCommandLines = await loadNormalizedProcessCommandLines();
            return fragments.some((fragment) => processCommandLines.some((commandLine) => commandLine.includes(fragment)));
        };
    }
}
exports.TranscriptSessionSubAgentActivityRepository = TranscriptSessionSubAgentActivityRepository;
//# sourceMappingURL=TranscriptSessionSubAgentActivityRepository.js.map