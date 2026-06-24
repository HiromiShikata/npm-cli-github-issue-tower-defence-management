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
exports.ProcClaudeInteractiveSessionRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const SESSION_ID_ENVIRON_KEY = 'CLAUDE_CODE_SESSION_ID';
const NAME_ARGUMENT = '--name';
const TAKE_OWNERSHIP_MARKER = 'Take ownership';
const isIssueUrl = (value) => value.startsWith('http://') || value.startsWith('https://');
const parseCommandLineArguments = (cmdline) => cmdline.split('\0').filter((argument) => argument.length > 0);
const extractIssueUrl = (commandArguments) => {
    for (let index = 0; index < commandArguments.length - 1; index += 1) {
        if (commandArguments[index] === NAME_ARGUMENT) {
            const value = commandArguments[index + 1] ?? '';
            if (isIssueUrl(value)) {
                return value;
            }
        }
    }
    return null;
};
const isTakeOwnershipSpawn = (commandArguments) => commandArguments.some((argument) => argument.includes(TAKE_OWNERSHIP_MARKER));
class ProcClaudeInteractiveSessionRepository {
    constructor(procDirectory = DEFAULT_PROC_DIRECTORY) {
        this.procDirectory = procDirectory;
        this.listInteractiveSessions = () => {
            const interactiveSessions = [];
            for (const pidDirectory of this.listProcessIdDirectories()) {
                const interactiveSession = this.readInteractiveSession(pidDirectory);
                if (interactiveSession !== null) {
                    interactiveSessions.push(interactiveSession);
                }
            }
            return interactiveSessions;
        };
        this.listProcessIdDirectories = () => {
            let entries;
            try {
                entries = fs.readdirSync(this.procDirectory);
            }
            catch {
                return [];
            }
            return entries.filter((entry) => /^\d+$/.test(entry));
        };
        this.readInteractiveSession = (processIdDirectory) => {
            const commandArguments = this.readCommandArguments(processIdDirectory);
            if (commandArguments === null) {
                return null;
            }
            if (isTakeOwnershipSpawn(commandArguments)) {
                return null;
            }
            const issueUrl = extractIssueUrl(commandArguments);
            if (issueUrl === null) {
                return null;
            }
            const environ = this.readEnviron(processIdDirectory);
            if (environ === null) {
                return null;
            }
            const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY);
            const sessionId = environ.get(SESSION_ID_ENVIRON_KEY);
            if (token === undefined ||
                token.length === 0 ||
                sessionId === undefined ||
                sessionId.length === 0) {
                return null;
            }
            return { token, sessionId, issueUrl };
        };
        this.readCommandArguments = (processIdDirectory) => {
            const cmdlinePath = path.join(this.procDirectory, processIdDirectory, 'cmdline');
            let raw;
            try {
                raw = fs.readFileSync(cmdlinePath, 'utf8');
            }
            catch {
                return null;
            }
            return parseCommandLineArguments(raw);
        };
        this.readEnviron = (processIdDirectory) => {
            const environPath = path.join(this.procDirectory, processIdDirectory, 'environ');
            let raw;
            try {
                raw = fs.readFileSync(environPath, 'utf8');
            }
            catch {
                return null;
            }
            const environ = new Map();
            for (const entry of raw.split('\0')) {
                if (entry.length === 0) {
                    continue;
                }
                const separatorIndex = entry.indexOf('=');
                if (separatorIndex <= 0) {
                    continue;
                }
                const key = entry.slice(0, separatorIndex);
                const value = entry.slice(separatorIndex + 1);
                environ.set(key, value);
            }
            return environ;
        };
    }
}
exports.ProcClaudeInteractiveSessionRepository = ProcClaudeInteractiveSessionRepository;
//# sourceMappingURL=ProcClaudeInteractiveSessionRepository.js.map