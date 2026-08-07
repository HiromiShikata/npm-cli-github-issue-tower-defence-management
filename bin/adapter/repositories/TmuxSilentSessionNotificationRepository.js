"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxSilentSessionNotificationRepository = exports.resolveInputBoxStateFromPane = exports.extractTmuxInputBoxContent = exports.DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS = exports.DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT = void 0;
const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';
exports.DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT = 3;
exports.DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS = 2500;
const INPUT_BOX_BORDER_LINE_PATTERN = /^[\s─━╌┄┈│╭╮╰╯]+$/u;
const INPUT_PROMPT_PREFIX_PATTERN = /^[\s>❯│]+/u;
const INPUT_BOX_MESSAGE_PROBE_LENGTH = 24;
const withoutWhitespace = (value) => value.replace(/\s+/gu, '');
const extractTmuxInputBoxContent = (paneText) => {
    const lines = paneText.split('\n');
    const borderLineIndexes = lines.flatMap((line, index) => line.trim().length > 0 && INPUT_BOX_BORDER_LINE_PATTERN.test(line)
        ? [index]
        : []);
    if (borderLineIndexes.length < 2) {
        return null;
    }
    const closingBorderIndex = borderLineIndexes[borderLineIndexes.length - 1];
    const openingBorderIndex = borderLineIndexes[borderLineIndexes.length - 2];
    return lines
        .slice(openingBorderIndex + 1, closingBorderIndex)
        .map((line) => line.replace(INPUT_PROMPT_PREFIX_PATTERN, ''))
        .join('');
};
exports.extractTmuxInputBoxContent = extractTmuxInputBoxContent;
const resolveInputBoxStateFromPane = (paneText, singleLineMessage) => {
    const inputBoxContent = (0, exports.extractTmuxInputBoxContent)(paneText);
    if (inputBoxContent === null) {
        return 'unreadable';
    }
    const messageProbe = withoutWhitespace(singleLineMessage).slice(0, INPUT_BOX_MESSAGE_PROBE_LENGTH);
    if (messageProbe.length === 0) {
        return 'clearedMessage';
    }
    return withoutWhitespace(inputBoxContent).includes(messageProbe)
        ? 'holdsMessage'
        : 'clearedMessage';
};
exports.resolveInputBoxStateFromPane = resolveInputBoxStateFromPane;
class TmuxSilentSessionNotificationRepository {
    constructor(localCommandRunner, sleeper, submitPushOutAttemptLimit = exports.DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT, submitPushOutWaitMilliseconds = exports.DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS) {
        this.localCommandRunner = localCommandRunner;
        this.sleeper = sleeper;
        this.submitPushOutAttemptLimit = submitPushOutAttemptLimit;
        this.submitPushOutWaitMilliseconds = submitPushOutWaitMilliseconds;
        this.sendSelfCheckNotification = async (sessionName, message) => {
            const singleLineMessage = message.replace(/\s*[\r\n]+\s*/g, ' ').trim();
            const framedMessage = `${BRACKETED_PASTE_START}${singleLineMessage}${BRACKETED_PASTE_END}`;
            const literalResult = await this.localCommandRunner.runCommand('tmux', [
                'send-keys',
                '-t',
                sessionName,
                '-l',
                framedMessage,
            ]);
            if (literalResult.exitCode !== 0) {
                throw new Error(`Failed to send notification to tmux session "${sessionName}": exit code ${literalResult.exitCode}${literalResult.stderr ? `: ${literalResult.stderr}` : ''}`);
            }
            await this.submitInputBox(sessionName);
            await this.pushOutUnsubmittedMessage(sessionName, singleLineMessage);
        };
        this.submitInputBox = async (sessionName) => {
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
        this.pushOutUnsubmittedMessage = async (sessionName, singleLineMessage) => {
            for (let attempt = 0; attempt < this.submitPushOutAttemptLimit; attempt += 1) {
                await this.sleeper.sleep(this.submitPushOutWaitMilliseconds);
                const inputBoxState = await this.readInputBoxState(sessionName, singleLineMessage);
                if (inputBoxState === 'clearedMessage') {
                    return;
                }
                if (inputBoxState === 'unreadable') {
                    console.log(`Could not read back the input box of tmux session "${sessionName}"; leaving the notification as sent without pushing it out.`);
                    return;
                }
                await this.submitInputBox(sessionName);
            }
            console.log(`Notification to tmux session "${sessionName}" was still held in the input box after ${this.submitPushOutAttemptLimit} push-out attempt(s).`);
        };
        this.readInputBoxState = async (sessionName, singleLineMessage) => {
            const captureResult = await this.localCommandRunner.runCommand('tmux', [
                'capture-pane',
                '-p',
                '-t',
                sessionName,
            ]);
            if (captureResult.exitCode !== 0) {
                console.log(`Failed to capture the pane of tmux session "${sessionName}": exit code ${captureResult.exitCode}${captureResult.stderr ? `: ${captureResult.stderr}` : ''}`);
                return 'unreadable';
            }
            return (0, exports.resolveInputBoxStateFromPane)(captureResult.stdout, singleLineMessage);
        };
    }
}
exports.TmuxSilentSessionNotificationRepository = TmuxSilentSessionNotificationRepository;
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.js.map