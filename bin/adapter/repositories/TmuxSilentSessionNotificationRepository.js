"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxSilentSessionNotificationRepository = void 0;
const CACHE_KEY_PREFIX = 'silent-session-notification';
const readEpochSeconds = (value) => {
    if (!('epochSeconds' in value)) {
        return null;
    }
    const candidate = value.epochSeconds;
    if (typeof candidate !== 'number') {
        return null;
    }
    return candidate;
};
class TmuxSilentSessionNotificationRepository {
    constructor(localCommandRunner, cacheRepository) {
        this.localCommandRunner = localCommandRunner;
        this.cacheRepository = cacheRepository;
        this.getLastNotifiedEpochSeconds = async (sessionName) => {
            const cached = await this.cacheRepository.getLatest(this.toCacheKey(sessionName));
            if (cached === null) {
                return null;
            }
            return readEpochSeconds(cached.value);
        };
        this.setLastNotifiedEpochSeconds = async (sessionName, epochSeconds) => {
            await this.cacheRepository.set(this.toCacheKey(sessionName), {
                epochSeconds,
            });
        };
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
        this.toCacheKey = (sessionName) => `${CACHE_KEY_PREFIX}/${sessionName.replace(/\//g, '_')}`;
    }
}
exports.TmuxSilentSessionNotificationRepository = TmuxSilentSessionNotificationRepository;
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.js.map