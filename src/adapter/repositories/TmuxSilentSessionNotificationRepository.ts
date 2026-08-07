import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { Sleeper } from '../../domain/usecases/adapter-interfaces/Sleeper';

const BRACKETED_PASTE_START = '\x1b[200~';
const BRACKETED_PASTE_END = '\x1b[201~';

export const DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT = 3;
export const DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS = 2500;

const INPUT_BOX_BORDER_LINE_PATTERN = /^[\s─━╌┄┈│╭╮╰╯]+$/u;
const INPUT_PROMPT_PREFIX_PATTERN = /^[\s>❯│]+/u;
const INPUT_BOX_MESSAGE_PROBE_LENGTH = 24;

type InputBoxState = 'holdsMessage' | 'clearedMessage' | 'unreadable';

const withoutWhitespace = (value: string): string => value.replace(/\s+/gu, '');

export const extractTmuxInputBoxContent = (paneText: string): string | null => {
  const lines = paneText.split('\n');
  const borderLineIndexes = lines.flatMap((line, index) =>
    line.trim().length > 0 && INPUT_BOX_BORDER_LINE_PATTERN.test(line)
      ? [index]
      : [],
  );
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

export const resolveInputBoxStateFromPane = (
  paneText: string,
  singleLineMessage: string,
): InputBoxState => {
  const inputBoxContent = extractTmuxInputBoxContent(paneText);
  if (inputBoxContent === null) {
    return 'unreadable';
  }
  const messageProbe = withoutWhitespace(singleLineMessage).slice(
    0,
    INPUT_BOX_MESSAGE_PROBE_LENGTH,
  );
  if (messageProbe.length === 0) {
    return 'clearedMessage';
  }
  return withoutWhitespace(inputBoxContent).includes(messageProbe)
    ? 'holdsMessage'
    : 'clearedMessage';
};

export class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly sleeper: Sleeper,
    private readonly submitPushOutAttemptLimit: number = DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT,
    private readonly submitPushOutWaitMilliseconds: number = DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS,
  ) {}

  sendSelfCheckNotification = async (
    sessionName: string,
    message: string,
  ): Promise<void> => {
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
      throw new Error(
        `Failed to send notification to tmux session "${sessionName}": exit code ${literalResult.exitCode}${
          literalResult.stderr ? `: ${literalResult.stderr}` : ''
        }`,
      );
    }
    await this.submitInputBox(sessionName);
    await this.pushOutUnsubmittedMessage(sessionName, singleLineMessage);
  };

  private submitInputBox = async (sessionName: string): Promise<void> => {
    const submitResult = await this.localCommandRunner.runCommand('tmux', [
      'send-keys',
      '-t',
      sessionName,
      'Enter',
    ]);
    if (submitResult.exitCode !== 0) {
      throw new Error(
        `Failed to send notification to tmux session "${sessionName}": exit code ${submitResult.exitCode}${
          submitResult.stderr ? `: ${submitResult.stderr}` : ''
        }`,
      );
    }
  };

  private pushOutUnsubmittedMessage = async (
    sessionName: string,
    singleLineMessage: string,
  ): Promise<void> => {
    for (
      let attempt = 0;
      attempt < this.submitPushOutAttemptLimit;
      attempt += 1
    ) {
      await this.sleeper.sleep(this.submitPushOutWaitMilliseconds);
      const inputBoxState = await this.readInputBoxState(
        sessionName,
        singleLineMessage,
      );
      if (inputBoxState === 'clearedMessage') {
        return;
      }
      if (inputBoxState === 'unreadable') {
        console.log(
          `Could not read back the input box of tmux session "${sessionName}"; leaving the notification as sent without pushing it out.`,
        );
        return;
      }
      await this.submitInputBox(sessionName);
    }
    console.log(
      `Notification to tmux session "${sessionName}" was still held in the input box after ${this.submitPushOutAttemptLimit} push-out attempt(s).`,
    );
  };

  private readInputBoxState = async (
    sessionName: string,
    singleLineMessage: string,
  ): Promise<InputBoxState> => {
    const captureResult = await this.localCommandRunner.runCommand('tmux', [
      'capture-pane',
      '-p',
      '-t',
      sessionName,
    ]);
    if (captureResult.exitCode !== 0) {
      console.log(
        `Failed to capture the pane of tmux session "${sessionName}": exit code ${captureResult.exitCode}${
          captureResult.stderr ? `: ${captureResult.stderr}` : ''
        }`,
      );
      return 'unreadable';
    }
    return resolveInputBoxStateFromPane(
      captureResult.stdout,
      singleLineMessage,
    );
  };
}
