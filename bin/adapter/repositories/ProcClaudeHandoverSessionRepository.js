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
exports.ProcClaudeHandoverSessionRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_PROC_DIRECTORY = '/proc';
const OAUTH_TOKEN_ENVIRON_KEY = 'CLAUDE_CODE_OAUTH_TOKEN';
const NAME_ARGUMENT = '--name';
const NAME_ARGUMENT_PREFIX = '--name=';
const PRINT_ARGUMENTS = ['-p', '--print'];
const PRINT_ARGUMENT_PREFIXES = ['-p=', '--print='];
const CLAUDE_COMM_PATTERN = /^claude(-agent)?$/;
const WORKSPACE_PREPARATION_SCOPE_PATTERN = /\/aw-[^/]*\.scope(\/|$)/;
const ISSUE_OR_PR_URL_PATTERN = /https:\/\/github\.com\/[^\s\0]+?\/(?:issues|pull)\/\d+/;
const normalizeName = (value) => value.replace(/[.:]/g, '_');
const isIssueUrl = (value) => value.startsWith('http://') || value.startsWith('https://');
const extractIssueUrlFromText = (text) => {
    const match = text.match(ISSUE_OR_PR_URL_PATTERN);
    return match ? match[0] : null;
};
const parseName = (commandArguments) => {
    for (let index = 0; index < commandArguments.length; index += 1) {
        const argument = commandArguments[index];
        if (argument === NAME_ARGUMENT && index + 1 < commandArguments.length) {
            const value = commandArguments[index + 1];
            return value.length > 0 ? value : null;
        }
        if (argument.startsWith(NAME_ARGUMENT_PREFIX)) {
            const value = argument.slice(NAME_ARGUMENT_PREFIX.length);
            return value.length > 0 ? value : null;
        }
    }
    return null;
};
const parseIssueUrlFromPrint = (commandArguments) => {
    for (let index = 0; index < commandArguments.length; index += 1) {
        const argument = commandArguments[index];
        if (PRINT_ARGUMENTS.includes(argument) &&
            index + 1 < commandArguments.length) {
            const url = extractIssueUrlFromText(commandArguments[index + 1]);
            if (url !== null) {
                return url;
            }
        }
        for (const prefix of PRINT_ARGUMENT_PREFIXES) {
            if (argument.startsWith(prefix)) {
                const url = extractIssueUrlFromText(argument.slice(prefix.length));
                if (url !== null) {
                    return url;
                }
            }
        }
    }
    return extractIssueUrlFromText(commandArguments.join(' '));
};
const classifySession = (pid, commandArguments, token, runsUnderWorkspacePreparationScript) => {
    if (token === null || token.length === 0) {
        return null;
    }
    const name = parseName(commandArguments);
    if (name !== null) {
        const sessionName = normalizeName(name);
        if (isIssueUrl(name)) {
            const kind = 'issueUrlLeader';
            return {
                kind,
                pid,
                token,
                sessionName,
                name,
                issueUrl: extractIssueUrlFromText(name),
                runsUnderWorkspacePreparationScript,
            };
        }
        const kind = 'bareNameLeader';
        return {
            kind,
            pid,
            token,
            sessionName,
            name,
            issueUrl: null,
            runsUnderWorkspacePreparationScript,
        };
    }
    const issueUrl = parseIssueUrlFromPrint(commandArguments);
    if (issueUrl === null) {
        return null;
    }
    return {
        kind: 'implSubagent',
        pid,
        token,
        sessionName: null,
        name: null,
        issueUrl,
        runsUnderWorkspacePreparationScript,
    };
};
class ProcClaudeHandoverSessionRepository {
    constructor(procDirectory = DEFAULT_PROC_DIRECTORY) {
        this.procDirectory = procDirectory;
        this.listHandoverSessions = () => {
            const sessions = [];
            for (const processIdDirectory of this.listProcessIdDirectories()) {
                const session = this.readHandoverSession(processIdDirectory);
                if (session !== null) {
                    sessions.push(session);
                }
            }
            return sessions;
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
        this.readHandoverSession = (processIdDirectory) => {
            const comm = this.readComm(processIdDirectory);
            if (comm === null || !CLAUDE_COMM_PATTERN.test(comm)) {
                return null;
            }
            const commandArguments = this.readCommandArguments(processIdDirectory);
            if (commandArguments === null) {
                return null;
            }
            const environ = this.readEnviron(processIdDirectory);
            if (environ === null) {
                return null;
            }
            const token = environ.get(OAUTH_TOKEN_ENVIRON_KEY) ?? null;
            return classifySession(Number(processIdDirectory), commandArguments, token, this.readRunsUnderWorkspacePreparationScript(processIdDirectory));
        };
        this.readRunsUnderWorkspacePreparationScript = (processIdDirectory) => {
            const cgroupPath = path.join(this.procDirectory, processIdDirectory, 'cgroup');
            let raw;
            try {
                raw = fs.readFileSync(cgroupPath, 'utf8');
            }
            catch (error) {
                console.error(`ProcClaudeHandoverSessionRepository: could not read ${cgroupPath}: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }
            for (const line of raw.split('\n')) {
                const firstSeparatorIndex = line.indexOf(':');
                if (firstSeparatorIndex < 0) {
                    continue;
                }
                const secondSeparatorIndex = line.indexOf(':', firstSeparatorIndex + 1);
                if (secondSeparatorIndex < 0) {
                    continue;
                }
                const cgroupHierarchyPath = line.slice(secondSeparatorIndex + 1);
                if (WORKSPACE_PREPARATION_SCOPE_PATTERN.test(cgroupHierarchyPath)) {
                    return true;
                }
            }
            return false;
        };
        this.readComm = (processIdDirectory) => {
            const commPath = path.join(this.procDirectory, processIdDirectory, 'comm');
            try {
                return fs.readFileSync(commPath, 'utf8').trim();
            }
            catch {
                return null;
            }
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
            return raw.split('\0').filter((argument) => argument.length > 0);
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
                environ.set(entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1));
            }
            return environ;
        };
    }
}
exports.ProcClaudeHandoverSessionRepository = ProcClaudeHandoverSessionRepository;
//# sourceMappingURL=ProcClaudeHandoverSessionRepository.js.map