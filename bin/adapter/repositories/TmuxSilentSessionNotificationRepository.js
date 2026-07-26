"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxSilentSessionNotificationRepository = void 0;
class TmuxSilentSessionNotificationRepository {
    constructor(localCommandRunner) {
        this.localCommandRunner = localCommandRunner;
        this.sendSelfCheckNotification = async (sessionName, message) => {
            const literalResult = await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                '-l',
                message,
            ]);
            if (literalResult.exitCode !== 0) {
                throw new Error(`Failed to send notification to tmux session "${sessionName}": exit code ${literalResult.exitCode}${literalResult.stderr ? `: ${literalResult.stderr}` : ''}`);
            }
            const submitResult = await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                'Enter',
            ]);
            if (submitResult.exitCode !== 0) {
                throw new Error(`Failed to send notification to tmux session "${sessionName}": exit code ${submitResult.exitCode}${submitResult.stderr ? `: ${submitResult.stderr}` : ''}`);
            }
        };
    }
}
exports.TmuxSilentSessionNotificationRepository = TmuxSilentSessionNotificationRepository;
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.js.map