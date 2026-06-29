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
exports.ProcClaudeLiveSessionRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const SESSION_ID_ENVIRON_KEY = 'CLAUDE_CODE_SESSION_ID';
const CONFIG_DIR_ENVIRON_KEY = 'CLAUDE_CONFIG_DIR';
const isClaudeProcessCommand = (command) => {
    if (command.length === 0) {
        return false;
    }
    if (command.includes('.local/share/claude')) {
        return true;
    }
    const executableName = path.basename(command.split('\0')[0] ?? '');
    return executableName === 'claude';
};
class ProcClaudeLiveSessionRepository {
    constructor(procDirectory = DEFAULT_PROC_DIRECTORY) {
        this.procDirectory = procDirectory;
        this.listLiveSessions = () => {
            const liveSessions = [];
            for (const pidDirectory of this.listProcessIdDirectories()) {
                const liveSession = this.readLiveSession(pidDirectory);
                if (liveSession !== null) {
                    liveSessions.push(liveSession);
                }
            }
            return liveSessions;
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
        this.readLiveSession = (processIdDirectory) => {
            const environ = this.readEnviron(processIdDirectory);
            if (environ === null) {
                return null;
            }
            const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY);
            if (token === undefined || token.length === 0) {
                return null;
            }
            const sessionKey = this.deriveSessionKey(environ);
            if (sessionKey === null) {
                return null;
            }
            if (!this.isClaudeProcess(processIdDirectory)) {
                return null;
            }
            return { token, sessionKey };
        };
        this.deriveSessionKey = (environ) => {
            const configDir = environ.get(CONFIG_DIR_ENVIRON_KEY);
            if (configDir !== undefined && configDir.length > 0) {
                return configDir;
            }
            const sessionId = environ.get(SESSION_ID_ENVIRON_KEY);
            if (sessionId !== undefined && sessionId.length > 0) {
                return sessionId;
            }
            return null;
        };
        this.isClaudeProcess = (processIdDirectory) => {
            const basePath = path.join(this.procDirectory, processIdDirectory);
            try {
                const cmdline = fs.readFileSync(path.join(basePath, 'cmdline'), 'utf8');
                if (isClaudeProcessCommand(cmdline)) {
                    return true;
                }
            }
            catch {
                return false;
            }
            try {
                const exe = fs.readlinkSync(path.join(basePath, 'exe'));
                return isClaudeProcessCommand(exe);
            }
            catch {
                return false;
            }
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
exports.ProcClaudeLiveSessionRepository = ProcClaudeLiveSessionRepository;
//# sourceMappingURL=ProcClaudeLiveSessionRepository.js.map