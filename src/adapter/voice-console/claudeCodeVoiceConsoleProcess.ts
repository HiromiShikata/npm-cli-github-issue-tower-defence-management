import { StringDecoder } from 'string_decoder';

export const CLAUDE_CODE_TURN_TIMEOUT_MS = 600000;

export type ClaudeCodeLaunch = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type ClaudeCodeReadable = {
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
};

export type ClaudeCodeWritable = {
  write(chunk: string): boolean;
  end(): void;
  on?(event: 'error', handler: (error: Error) => void): unknown;
};

export type ClaudeCodeChildProcess = {
  stdin: ClaudeCodeWritable;
  stdout: ClaudeCodeReadable;
  stderr: ClaudeCodeReadable;
  on(event: 'exit' | 'error', handler: (...args: unknown[]) => void): unknown;
  kill(): boolean;
};

export type ClaudeCodeSpawn = (
  command: string,
  args: string[],
  env: Record<string, string>,
) => ClaudeCodeChildProcess;

export type ClaudeCodeTurnTimerHandle = ReturnType<typeof setTimeout>;

export type ClaudeCodeTurnTimers = {
  setTimeout(callback: () => void, delayMs: number): ClaudeCodeTurnTimerHandle;
  clearTimeout(handle: ClaudeCodeTurnTimerHandle): void;
};

export type ClaudeCodeVoiceConsoleProcessDependencies = {
  spawn: ClaudeCodeSpawn;
  logError: (message: string) => void;
  timers?: ClaudeCodeTurnTimers;
};

type PendingTurn = {
  resolve: (resultText: string) => void;
  reject: (error: Error) => void;
  timer: ClaudeCodeTurnTimerHandle | null;
};

const STDERR_TAIL_LINES = 20;
const STOPPED_MESSAGE = 'Claude Code voice console process was stopped';

const defaultTurnTimers: ClaudeCodeTurnTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describeResultFailure = (
  event: Record<string, unknown>,
): string | null => {
  if (event.is_error === true || event.subtype !== 'success') {
    return `Claude Code turn ended with subtype ${String(event.subtype)}, is_error ${String(event.is_error)}, result ${String(event.result)}`;
  }
  if (typeof event.result !== 'string') {
    return 'Claude Code success result has no result text';
  }
  return null;
};

export class ClaudeCodeVoiceConsoleProcess {
  private launch: ClaudeCodeLaunch | null = null;
  private child: ClaudeCodeChildProcess | null = null;
  private stdoutDecoder = new StringDecoder('utf8');
  private stderrDecoder = new StringDecoder('utf8');
  private readonly timers: ClaudeCodeTurnTimers;
  private stdoutBuffer = '';
  private stderrTail: string[] = [];
  private pendingTurn: PendingTurn | null = null;
  private queueTail: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly dependencies: ClaudeCodeVoiceConsoleProcessDependencies,
  ) {
    this.timers = dependencies.timers ?? defaultTurnTimers;
  }

  start(launch: ClaudeCodeLaunch): void {
    if (this.launch !== null) {
      throw new Error('Claude Code voice console process was already started');
    }
    this.launch = launch;
    this.spawnChild();
  }

  sendOwnerUtterance(text: string): Promise<string> {
    const turn = this.queueTail.then(() => this.runTurn(text));
    this.queueTail = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const child = this.child;
    const turn = this.takePendingTurn();
    turn?.reject(new Error(this.withStderrTail(STOPPED_MESSAGE)));
    child?.kill();
  }

  private spawnChild(): void {
    const launch = this.launch;
    if (launch === null) {
      throw new Error('Claude Code voice console process has not been started');
    }
    const child = this.dependencies.spawn(
      launch.command,
      launch.args,
      launch.env,
    );
    this.child = child;
    this.stdoutDecoder = new StringDecoder('utf8');
    this.stderrDecoder = new StringDecoder('utf8');
    this.stdoutBuffer = '';
    this.stderrTail = [];
    child.stdout.on('data', (chunk) => {
      if (this.child === child) this.handleStdout(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (this.child === child) this.handleStderr(chunk);
    });
    child.stdin.on?.('error', (error) => {
      if (this.child !== child) return;
      this.discardChild(
        `Claude Code voice console stdin error: ${describeError(error)}; the Claude Code process is killed and the next turn starts a fresh one`,
      );
    });
    child.on('error', (error) => {
      if (this.child !== child) return;
      this.discardChild(
        `Claude Code voice console process error: ${describeError(error)}; the Claude Code process is killed and the next turn starts a fresh one`,
      );
    });
    child.on('exit', (code, signal) => {
      if (this.child !== child || this.stopped) return;
      this.discardChild(
        `Claude Code voice console process exited with code ${String(code)} and signal ${String(signal)}; the next turn starts a fresh process`,
      );
    });
  }

  private runTurn(text: string): Promise<string> {
    if (this.launch === null) {
      return Promise.reject(
        new Error('Claude Code voice console process has not been started'),
      );
    }
    if (this.stopped) {
      return Promise.reject(new Error(this.withStderrTail(STOPPED_MESSAGE)));
    }
    if (this.child === null) {
      try {
        this.spawnChild();
      } catch (error) {
        const message = `Claude Code voice console process could not restart after a timed-out turn: ${describeError(error)}`;
        this.dependencies.logError(message);
        return Promise.reject(new Error(message));
      }
    }
    const child = this.child;
    if (child === null) {
      return Promise.reject(
        new Error('Claude Code voice console process has not been started'),
      );
    }
    return new Promise<string>((resolve, reject) => {
      const turn: PendingTurn = { resolve, reject, timer: null };
      turn.timer = this.timers.setTimeout(
        () => this.timeOutTurn(turn),
        CLAUDE_CODE_TURN_TIMEOUT_MS,
      );
      this.pendingTurn = turn;
      const message = {
        type: 'user',
        message: { role: 'user', content: text },
      };
      child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  private timeOutTurn(turn: PendingTurn): void {
    if (this.pendingTurn !== turn) return;
    this.discardChild(
      `Claude Code turn did not finish within ${CLAUDE_CODE_TURN_TIMEOUT_MS} ms; the Claude Code process is killed and the next turn starts a fresh one`,
    );
  }

  private discardChild(message: string): void {
    const diagnostic = this.withStderrTail(message);
    this.dependencies.logError(diagnostic);
    const child = this.child;
    this.child = null;
    child?.kill();
    this.takePendingTurn()?.reject(new Error(diagnostic));
  }

  private takePendingTurn(): PendingTurn | null {
    const turn = this.pendingTurn;
    this.pendingTurn = null;
    if (turn !== null && turn.timer !== null) {
      this.timers.clearTimeout(turn.timer);
    }
    return turn;
  }

  private handleStdout(chunk: Buffer | string): void {
    this.stdoutBuffer +=
      typeof chunk === 'string' ? chunk : this.stdoutDecoder.write(chunk);
    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      this.handleStdoutLine(line);
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleStdoutLine(line: string): void {
    if (line.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.dependencies.logError(
        `Claude Code voice console printed a malformed stdout line: ${describeError(error)}; line: ${line}`,
      );
      return;
    }
    if (!isRecord(parsed) || parsed.type !== 'result') return;
    const turn = this.takePendingTurn();
    if (turn === null) return;
    const failure = describeResultFailure(parsed);
    if (failure !== null) {
      turn.reject(new Error(failure));
      return;
    }
    turn.resolve(String(parsed.result));
  }

  private handleStderr(chunk: Buffer | string): void {
    const text =
      typeof chunk === 'string' ? chunk : this.stderrDecoder.write(chunk);
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue;
      this.stderrTail.push(line);
    }
    this.stderrTail = this.stderrTail.slice(-STDERR_TAIL_LINES);
  }

  private withStderrTail(reason: string): string {
    const stderrTail = this.stderrTail.join(' | ');
    return stderrTail.length > 0
      ? `${reason}; last stderr lines: ${stderrTail}`
      : reason;
  }
}
