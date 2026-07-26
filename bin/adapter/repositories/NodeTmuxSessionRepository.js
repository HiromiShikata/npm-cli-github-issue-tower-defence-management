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
exports.NodeTmuxSessionRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const clSessionScopeUnitName_1 = require("./clSessionScopeUnitName");
const clSessionScopeUnitNameFromCgroupContent_1 = require("./clSessionScopeUnitNameFromCgroupContent");
const DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS = 1000;
const SEND_KEYS_COMPOSER_PROBE_LENGTH = 40;
const SEND_KEYS_COMPOSER_TAIL_LINES = 8;
const shellSingleQuote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
class NodeTmuxSessionRepository {
    constructor(localCommandRunner, procDirectory = '/proc', submitDelayMilliseconds = DEFAULT_SEND_KEYS_SUBMIT_DELAY_MS) {
        this.localCommandRunner = localCommandRunner;
        this.procDirectory = procDirectory;
        this.submitDelayMilliseconds = submitDelayMilliseconds;
        this.listLiveSessionNames = async () => {
            const { stdout, exitCode } = await this.localCommandRunner.runCommand('tmux', ['list-sessions', '-F', '#{session_name}']);
            if (exitCode !== 0) {
                return [];
            }
            return stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
        };
        this.listLiveSessionsWithActivity = async () => {
            const { stdout, exitCode } = await this.localCommandRunner.runCommand('tmux', ['list-sessions', '-F', '#{session_name} #{session_activity}']);
            if (exitCode !== 0) {
                return [];
            }
            return stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map((line) => {
                const separatorIndex = line.lastIndexOf(' ');
                const sessionName = line.slice(0, separatorIndex);
                const activityEpochSeconds = Number(line.slice(separatorIndex + 1));
                return { sessionName, activityEpochSeconds };
            });
        };
        this.listInteractiveProcessCommandLines = async () => {
            const { stdout, exitCode } = await this.localCommandRunner.runCommand('ps', ['-eo', 'args=']);
            if (exitCode !== 0) {
                return [];
            }
            return stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);
        };
        this.launchDetachedSession = async (sessionName, launcherCommand, issueUrl) => {
            await this.localCommandRunner.runCommand('tmux', [
                'new-session',
                '-A',
                '-d',
                '-s',
                sessionName,
                'sh',
                '-lc',
                `exec "$1" "$2"`,
                'sh',
                launcherCommand,
                issueUrl,
            ]);
        };
        this.killSession = async (sessionName) => {
            const scopeUnitName = (0, clSessionScopeUnitName_1.clSessionScopeUnitName)(sessionName);
            await this.stopScopeUnit(scopeUnitName);
            const { stderr, exitCode } = await this.localCommandRunner.runCommand('tmux', ['kill-session', '-t', `=${sessionName}`]);
            if (exitCode !== 0) {
                throw new Error(`Failed to kill tmux session "${sessionName}": exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`);
            }
        };
        this.killOwnSession = async () => {
            const cgroupContent = fs.readFileSync(path.join(this.procDirectory, 'self', 'cgroup'), 'utf8');
            const scopeUnitName = (0, clSessionScopeUnitNameFromCgroupContent_1.clSessionScopeUnitNameFromCgroupContent)(cgroupContent);
            if (scopeUnitName === null) {
                throw new Error('Failed to determine the current cl-*.scope systemd user unit from /proc/self/cgroup');
            }
            await this.stopScopeUnit(scopeUnitName);
        };
        this.stopScopeUnit = async (scopeUnitName) => {
            await this.localCommandRunner.runCommand('systemctl', [
                '--user',
                'reset-failed',
                scopeUnitName,
            ]);
            const { stderr, exitCode } = await this.localCommandRunner.runCommand('systemctl', ['--user', 'stop', scopeUnitName]);
            await this.localCommandRunner.runCommand('systemctl', [
                '--user',
                'reset-failed',
                scopeUnitName,
            ]);
            if (exitCode !== 0) {
                console.error(`Failed to stop systemd user scope "${scopeUnitName}": exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`);
            }
        };
        this.sendKeys = async (sessionName, literalText) => {
            const literalResult = await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                '-l',
                literalText,
            ]);
            if (literalResult.exitCode !== 0) {
                throw new Error(`Failed to send keys to tmux session "${sessionName}": exit code ${literalResult.exitCode}${literalResult.stderr ? `: ${literalResult.stderr}` : ''}`);
            }
            await this.delaySubmit();
            await this.sendEnter(sessionName);
            if (await this.messageStillInComposer(sessionName, literalText)) {
                await this.delaySubmit();
                await this.sendEnter(sessionName);
            }
        };
        this.launchBareNameLeaderSession = async (name) => {
            const sessionName = name.replace(/[.:]/g, '_');
            const leaderCommand = `cl ${shellSingleQuote(name)}; exec /bin/bash`;
            const { stderr, exitCode } = await this.localCommandRunner.runCommand('tmux', ['new-session', '-d', '-s', sessionName, 'bash', '-lc', leaderCommand]);
            if (exitCode !== 0) {
                throw new Error(`Failed to relaunch bare-name leader session "${sessionName}": exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`);
            }
        };
        this.sendEnter = async (sessionName) => {
            const enterResult = await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                'Enter',
            ]);
            if (enterResult.exitCode !== 0) {
                throw new Error(`Failed to send Enter to tmux session "${sessionName}": exit code ${enterResult.exitCode}${enterResult.stderr ? `: ${enterResult.stderr}` : ''}`);
            }
        };
        this.messageStillInComposer = async (sessionName, literalText) => {
            const probe = literalText
                .trim()
                .split('\n', 1)[0]
                .slice(0, SEND_KEYS_COMPOSER_PROBE_LENGTH);
            if (probe.length === 0) {
                return false;
            }
            const { stdout, exitCode } = await this.localCommandRunner.runCommand('tmux', ['capture-pane', '-p', '-t', sessionName]);
            if (exitCode !== 0) {
                return false;
            }
            const tail = stdout
                .split('\n')
                .slice(-SEND_KEYS_COMPOSER_TAIL_LINES)
                .join('\n');
            return tail.includes(probe);
        };
        this.delaySubmit = async () => {
            if (this.submitDelayMilliseconds <= 0) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, this.submitDelayMilliseconds));
        };
    }
}
exports.NodeTmuxSessionRepository = NodeTmuxSessionRepository;
//# sourceMappingURL=NodeTmuxSessionRepository.js.map