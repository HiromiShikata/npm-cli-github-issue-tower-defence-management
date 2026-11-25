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
  private child: ClaudeCodeChildProcess | null = null;
  private readonly stdoutDecoder = new StringDecoder('utf8');
  private readonly stderrDecoder = new StringDecoder('utf8');
  private readonly timers: ClaudeCodeTurnTimers;
  private stdoutBuffer = '';
  private stderrTail: string[] = [];
  private pendingTurn: PendingTurn | null = null;
  private abandonedTurns = 0;
  private queueTail: Promise<void> = Promise.resolve();
  private terminatedBy: string | null = null;
  private stopped = false;

  constructor(
    private readonly dependencies: ClaudeCodeVoiceConsoleProcessDependencies,
  ) {
    this.timers = dependencies.timers ?? defaultTurnTimers;
  }

  start(launch: ClaudeCodeLaunch): void {
    if (this.child !== null) {
      throw new Error('Claude Code voice console process was already started');
    }
    const child = this.dependencies.spawn(
      launch.command,
      launch.args,
      launch.env,
    );
    this.child = child;
    child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    child.stderr.on('data', (chunk) => this.handleStderr(chunk));
    child.stdin.on?.('error', (error) => {
      this.terminate(
        `Claude Code voice console stdin error: ${describeError(error)}`,
      );
    });
    child.on('error', (error) => {
      this.terminate(
        `Claude Code voice console process error: ${describeError(error)}`,
      );
    });
    child.on('exit', (code, signal) => {
      this.terminate(
        `Claude Code voice console process exited with code ${String(code)} and signal ${String(signal)}`,
      );
    });
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
    const shouldKill = this.terminatedBy === null && this.child !== null;
    this.terminatedBy ??= 'Claude Code voice console process was stopped';
    const turn = this.takePendingTurn();
    turn?.reject(new Error(this.describeTermination()));
    if (shouldKill) {
      this.child?.kill();
    }
  }

  private runTurn(text: string): Promise<string> {
    const child = this.child;
    if (child === null) {
      return Promise.reject(
        new Error('Claude Code voice console process has not been started'),
      );
    }
    if (this.terminatedBy !== null) {
      return Promise.reject(new Error(this.describeTermination()));
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
    this.pendingTurn = null;
    this.abandonedTurns += 1;
    const message = `Claude Code turn did not finish within ${CLAUDE_CODE_TURN_TIMEOUT_MS} ms; the turn is abandoned and its late result will be discarded`;
    this.dependencies.logError(message);
    turn.reject(new Error(message));
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
    if (this.abandonedTurns > 0) {
      this.abandonedTurns -= 1;
      this.dependencies.logError(
        'Claude Code voice console discarded the late result of an abandoned turn',
      );
      return;
    }
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

  private describeTermination(): string {
    const reason =
      this.terminatedBy ?? 'Claude Code voice console process is not running';
    const stderrTail = this.stderrTail.join(' | ');
    return stderrTail.length > 0
      ? `${reason}; last stderr lines: ${stderrTail}`
      : reason;
  }

  private terminate(reason: string): void {
    if (this.terminatedBy !== null) return;
    this.terminatedBy = reason;
    const message = this.describeTermination();
    const turn = this.takePendingTurn();
    this.dependencies.logError(message);
    turn?.reject(new Error(message));
  }
}
