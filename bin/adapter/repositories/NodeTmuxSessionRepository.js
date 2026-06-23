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
    }
}
exports.NodeTmuxSessionRepository = NodeTmuxSessionRepository;
//# sourceMappingURL=NodeTmuxSessionRepository.js.map