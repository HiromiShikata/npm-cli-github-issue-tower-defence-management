import { StringDecoder } from 'string_decoder';

export type ClaudeCodeLaunch = {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type ClaudeCodeReadable = {
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
};

export type ClaudeCodeChildProcess = {
  stdin: {
    write(chunk: string): boolean;
    end(): void;
  };
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

export type ClaudeCodeVoiceConsoleProcessDependencies = {
  spawn: ClaudeCodeSpawn;
  logError: (message: string) => void;
};

type PendingTurn = {
  resolve: (resultText: string) => void;
  reject: (error: Error) => void;
};

const STDERR_TAIL_LINES = 20;

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
  private stdoutBuffer = '';
  private stderrTail: string[] = [];
  private pendingTurn: PendingTurn | null = null;
  private queueTail: Promise<void> = Promise.resolve();
  private terminatedBy: string | null = null;
  private stopped = false;

  constructor(
    private readonly dependencies: ClaudeCodeVoiceConsoleProcessDependencies,
  ) {}

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
    const pending = this.pendingTurn;
    this.pendingTurn = null;
    pending?.reject(new Error(this.describeTermination()));
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
      this.pendingTurn = { resolve, reject };
      const message = {
        type: 'user',
        message: { role: 'user', content: text },
      };
      child.stdin.write(`${JSON.stringify(message)}\n`);
    });
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
    const turn = this.pendingTurn;
    if (turn === null) return;
    this.pendingTurn = null;
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
    const pending = this.pendingTurn;
    this.pendingTurn = null;
    this.dependencies.logError(message);
    pending?.reject(new Error(message));
  }
}
