"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTmuxSessionRepository = void 0;
class NodeTmuxSessionRepository {
    constructor(localCommandRunner) {
        this.localCommandRunner = localCommandRunner;
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
            const { stderr, exitCode } = await this.localCommandRunner.runCommand('tmux', ['kill-session', '-t', sessionName]);
            if (exitCode !== 0) {
                throw new Error(`Failed to kill tmux session "${sessionName}": exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`);
            }
        };
        this.sendKeys = async (sessionName, literalText) => {
            await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                '-l',
                literalText,
            ]);
            await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                'Enter',
            ]);
        };
    }
}
exports.NodeTmuxSessionRepository = NodeTmuxSessionRepository;
//# sourceMappingURL=NodeTmuxSessionRepository.js.map