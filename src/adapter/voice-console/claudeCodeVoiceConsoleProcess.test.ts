import { EventEmitter } from 'events';
import {
  CLAUDE_CODE_TURN_TIMEOUT_MS,
  ClaudeCodeVoiceConsoleProcess,
  type ClaudeCodeChildProcess,
  type ClaudeCodeTurnTimerHandle,
  type ClaudeCodeTurnTimers,
} from './claudeCodeVoiceConsoleProcess';

const LAUNCH = {
  command: 'claude-agent',
  args: ['--agent', 'general'],
  env: { CLAUDE_CODE_OAUTH_TOKEN: 'token' },
};

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const parseLine = (line: string): unknown => JSON.parse(line);

const resultLine = (fields: Record<string, unknown>): string =>
  `${JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...fields })}\n`;

const createFakeChild = () => {
  const written: string[] = [];
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const exitEmitter = new EventEmitter();
  const stdinEmitter = new EventEmitter();
  const kill = jest.fn((): boolean => true);

  const child: ClaudeCodeChildProcess = {
    stdin: {
      write: (chunk: string): boolean => {
        written.push(chunk);
        return true;
      },
      end: jest.fn(),
      on: <Args extends unknown[]>(
        event: 'error',
        handler: (...args: Args) => void,
      ) => stdinEmitter.on(event, handler),
    },
    stdout,
    stderr,
    on: <Args extends unknown[]>(
      event: 'exit' | 'error',
      handler: (...args: Args) => void,
    ) => exitEmitter.on(event, handler),
    kill,
  };

  return {
    child,
    written,
    kill,
    emitStdout: (chunk: Buffer | string): void => {
      stdout.emit('data', chunk);
    },
    emitStderr: (chunk: Buffer | string): void => {
      stderr.emit('data', chunk);
    },
    emitExit: (code: number | null, signal: string | null): void => {
      exitEmitter.emit('exit', code, signal);
    },
    emitError: (error: Error): void => {
      exitEmitter.emit('error', error);
    },
    emitStdinError: (error: Error): void => {
      stdinEmitter.emit('error', error);
    },
  };
};

const createProcess = (options: { timers?: ClaudeCodeTurnTimers } = {}) => {
  const initial = createFakeChild();
  const children: ReturnType<typeof createFakeChild>[] = [initial];
  let spawnCount = 0;
  const spawn = jest.fn(
    (_command: string, _args: string[], _env: Record<string, string>) => {
      spawnCount += 1;
      if (spawnCount === 1) {
        return initial.child;
      }
      const fake = createFakeChild();
      children.push(fake);
      return fake.child;
    },
  );
  const logError = jest.fn((_message: string) => undefined);
  const process = new ClaudeCodeVoiceConsoleProcess({
    spawn,
    logError,
    timers: options.timers,
  });
  return { ...initial, children, spawn, logError, process };
};

describe('ClaudeCodeVoiceConsoleProcess start', () => {
  it('spawns the launch command once with its arguments and environment', () => {
    const { process, spawn } = createProcess();

    process.start(LAUNCH);

    expect(spawn.mock.calls).toEqual([
      [LAUNCH.command, LAUNCH.args, LAUNCH.env],
    ]);
  });

  it('throws when start is called a second time', () => {
    const { process, spawn } = createProcess();
    process.start(LAUNCH);

    expect(() => process.start(LAUNCH)).toThrow();
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});

describe('ClaudeCodeVoiceConsoleProcess owner utterance', () => {
  it('writes one stream-json user message line per utterance', async () => {
    const cases = [
      { name: 'a Japanese utterance', text: 'はい' },
      {
        name: 'a multi-line utterance is still one JSON line',
        text: 'line1\nline2',
      },
      { name: 'quotes and backslashes are escaped', text: '"quoted" \\ back' },
    ];

    for (const testCase of cases) {
      const { process, written } = createProcess();
      process.start(LAUNCH);

      void process.sendOwnerUtterance(testCase.text);
      await flush();
      const line = written[0] ?? '';
      const message: unknown = JSON.parse(line);

      expect({
        name: testCase.name,
        lineCount: written.length,
        message,
        endsWithNewline: line.endsWith('\n'),
        newlinesInside: line.slice(0, -1).includes('\n'),
      }).toEqual({
        name: testCase.name,
        lineCount: 1,
        message: {
          type: 'user',
          message: { role: 'user', content: testCase.text },
        },
        endsWithNewline: true,
        newlinesInside: false,
      });
    }
  });

  it('resolves with the result string of the next result event', async () => {
    const cases: {
      name: string;
      chunks: (Buffer | string)[];
      expected: string;
    }[] = [
      {
        name: 'a complete result line',
        chunks: [resultLine({ result: 'はい、わかりました' })],
        expected: 'はい、わかりました',
      },
      {
        name: 'a result line split across chunks is buffered until its newline',
        chunks: [
          '{"type":"result","subtype":"success",',
          '"is_error":false,"result":"分割"}',
          '\n',
        ],
        expected: '分割',
      },
      {
        name: 'events before the result are ignored',
        chunks: [
          `${JSON.stringify({ type: 'system', subtype: 'init' })}\n${JSON.stringify({ type: 'assistant', message: {} })}\n${resultLine({ result: '最後' })}`,
        ],
        expected: '最後',
      },
      {
        name: 'a Buffer chunk is decoded like a string',
        chunks: [Buffer.from(resultLine({ result: 'バッファ' }))],
        expected: 'バッファ',
      },
    ];

    for (const testCase of cases) {
      const { process, emitStdout } = createProcess();
      process.start(LAUNCH);

      const turn = process.sendOwnerUtterance('質問');
      await flush();
      for (const chunk of testCase.chunks) {
        emitStdout(chunk);
      }

      await expect(turn).resolves.toBe(testCase.expected);
    }
  });

  it('rejects with a diagnostic error when the result is an error', async () => {
    const cases: {
      name: string;
      resultFields: Record<string, unknown>;
      expectedFragment: string;
    }[] = [
      {
        name: 'is_error true carries the result text',
        resultFields: { is_error: true, result: 'API overloaded' },
        expectedFragment: 'API overloaded',
      },
      {
        name: 'error_max_turns subtype names the subtype',
        resultFields: {
          subtype: 'error_max_turns',
          is_error: false,
          result: '',
        },
        expectedFragment: 'error_max_turns',
      },
      {
        name: 'error_during_execution subtype names the subtype',
        resultFields: {
          subtype: 'error_during_execution',
          is_error: true,
        },
        expectedFragment: 'error_during_execution',
      },
    ];

    for (const testCase of cases) {
      const { process, emitStdout } = createProcess();
      process.start(LAUNCH);

      const turn = process.sendOwnerUtterance('質問');
      await flush();
      emitStdout(resultLine(testCase.resultFields));

      await expect(turn).rejects.toThrow(testCase.expectedFragment);
    }
  });

  it('serializes turns: the second utterance is written only after the first result', async () => {
    const { process, written, emitStdout } = createProcess();
    process.start(LAUNCH);

    const first = process.sendOwnerUtterance('一つ目');
    const second = process.sendOwnerUtterance('二つ目');
    await flush();
    expect(written).toHaveLength(1);

    emitStdout(resultLine({ result: 'R1' }));
    await expect(first).resolves.toBe('R1');
    await flush();
    expect(written).toHaveLength(2);
    expect(JSON.parse(written[1] ?? '')).toEqual({
      type: 'user',
      message: { role: 'user', content: '二つ目' },
    });

    emitStdout(resultLine({ result: 'R2' }));
    await expect(second).resolves.toBe('R2');
  });
});

describe('ClaudeCodeVoiceConsoleProcess failures', () => {
  it('rejects the pending turn on exit with the code, signal and last stderr lines, and logs them', async () => {
    const cases: {
      name: string;
      code: number | null;
      signal: string | null;
      expectedFragment: string;
    }[] = [
      { name: 'exit code 42', code: 42, signal: null, expectedFragment: '42' },
      {
        name: 'killed by a signal',
        code: null,
        signal: 'SIGKILL',
        expectedFragment: 'SIGKILL',
      },
    ];

    for (const testCase of cases) {
      const { process, emitStderr, emitExit, logError } = createProcess();
      process.start(LAUNCH);
      const turn = process.sendOwnerUtterance('質問');
      await flush();
      emitStderr('early line\n');
      emitStderr('line two\n');

      emitExit(testCase.code, testCase.signal);

      await expect(turn).rejects.toThrow(testCase.expectedFragment);
      await expect(turn).rejects.toThrow('line two');
      const logged = logError.mock.calls.map((call) => call[0]).join('\n');
      expect(logged).toContain(testCase.expectedFragment);
      expect(logged).toContain('line two');
    }
  });

  it('rejects the pending turn on a child error event and logs it', async () => {
    const { process, emitError, logError } = createProcess();
    process.start(LAUNCH);
    const turn = process.sendOwnerUtterance('質問');
    await flush();

    emitError(new Error('spawn ENOENT'));

    await expect(turn).rejects.toThrow('spawn ENOENT');
    expect(logError.mock.calls.map((call) => call[0]).join('\n')).toContain(
      'spawn ENOENT',
    );
  });

  it('rejects every utterance sent after the child has exited without writing it', async () => {
    const { process, emitExit, written } = createProcess();
    process.start(LAUNCH);
    emitExit(1, null);

    await expect(process.sendOwnerUtterance('後の質問')).rejects.toThrow();
    expect(written).toHaveLength(0);
  });

  it('rejects an utterance sent before start', async () => {
    const { process, written } = createProcess();

    await expect(process.sendOwnerUtterance('先の質問')).rejects.toThrow();
    expect(written).toHaveLength(0);
  });
});

describe('ClaudeCodeVoiceConsoleProcess stop', () => {
  it('kills the child once and rejects later utterances, however often stop is called', async () => {
    const cases = [
      { name: 'stop once', stopCount: 1 },
      { name: 'stop twice', stopCount: 2 },
      { name: 'stop three times', stopCount: 3 },
    ];

    for (const testCase of cases) {
      const { process, kill, written } = createProcess();
      process.start(LAUNCH);

      for (let index = 0; index < testCase.stopCount; index += 1) {
        process.stop();
      }
      await expect(process.sendOwnerUtterance('停止後')).rejects.toThrow();

      expect({
        name: testCase.name,
        killCalls: kill.mock.calls.length,
        writes: written.length,
      }).toEqual({ name: testCase.name, killCalls: 1, writes: 0 });
    }
  });
});

describe('ClaudeCodeVoiceConsoleProcess stdin errors', () => {
  it('rejects the pending turn with a diagnostic error and logs it when stdin fails', async () => {
    const { process, emitStdinError, logError } = createProcess();
    process.start(LAUNCH);
    const turn = process.sendOwnerUtterance('質問');
    await flush();

    expect(() => emitStdinError(new Error('EPIPE: broken pipe'))).not.toThrow();

    await expect(turn).rejects.toThrow('EPIPE: broken pipe');
    expect(logError.mock.calls.map((call) => call[0]).join('\n')).toContain(
      'EPIPE: broken pipe',
    );
  });

  it('logs a stdin error without throwing when no turn is pending', () => {
    const { process, emitStdinError, logError } = createProcess();
    process.start(LAUNCH);

    expect(() => emitStdinError(new Error('EPIPE: broken pipe'))).not.toThrow();
    expect(logError.mock.calls.map((call) => call[0]).join('\n')).toContain(
      'EPIPE: broken pipe',
    );
  });
});

describe('ClaudeCodeVoiceConsoleProcess turn timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses a 600000 millisecond turn timeout', () => {
    expect(CLAUDE_CODE_TURN_TIMEOUT_MS).toBe(600000);
  });

  it('kills the timed-out child, ignores its late result, and answers the next turn from a fresh child', async () => {
    const setTimer = jest.fn((callback: () => void, delayMs: number) =>
      setTimeout(callback, delayMs),
    );
    const clearTimer = jest.fn((handle: ClaudeCodeTurnTimerHandle) =>
      clearTimeout(handle),
    );
    const { process, children, spawn } = createProcess({
      timers: { setTimeout: setTimer, clearTimeout: clearTimer },
    });
    process.start(LAUNCH);

    const timedOut = process.sendOwnerUtterance('待たされる質問');
    await flush();
    expect(setTimer.mock.calls.map((call) => call[1])).toEqual([
      CLAUDE_CODE_TURN_TIMEOUT_MS,
    ]);

    jest.advanceTimersByTime(CLAUDE_CODE_TURN_TIMEOUT_MS);

    await expect(timedOut).rejects.toThrow(`${CLAUDE_CODE_TURN_TIMEOUT_MS} ms`);
    expect(children[0]?.kill.mock.calls.length).toBe(1);

    children[0]?.emitStdout(resultLine({ result: '遅れた回答' }));
    await flush();

    const next = process.sendOwnerUtterance('次の質問');
    const nextOutcome = next.then(
      (value) => value,
      (error: unknown) =>
        error instanceof Error ? `rejected: ${error.message}` : 'rejected',
    );
    await flush();

    expect({
      spawnCalls: spawn.mock.calls.length,
      killedChildWrites: children[0]?.written.length,
      freshChildWrites: children[1]?.written.length,
      freshChildContent: parseLine(children[1]?.written[0] ?? '{}'),
    }).toEqual({
      spawnCalls: 2,
      killedChildWrites: 1,
      freshChildWrites: 1,
      freshChildContent: {
        type: 'user',
        message: { role: 'user', content: '次の質問' },
      },
    });

    children[0]?.emitStdout(resultLine({ result: '殺された子の回答' }));
    await flush();
    expect(
      await Promise.race([nextOutcome, flush().then(() => 'still pending')]),
    ).toBe('still pending');

    children[1]?.emitStdout(resultLine({ result: '次の回答' }));
    await flush();
    expect(
      await Promise.race([nextOutcome, flush().then(() => 'still pending')]),
    ).toBe('次の回答');
  });

  it('clears the timer when the result arrives before the timeout', async () => {
    const setTimer = jest.fn((callback: () => void, delayMs: number) =>
      setTimeout(callback, delayMs),
    );
    const clearTimer = jest.fn((handle: ClaudeCodeTurnTimerHandle) =>
      clearTimeout(handle),
    );
    const { process, emitStdout } = createProcess({
      timers: { setTimeout: setTimer, clearTimeout: clearTimer },
    });
    process.start(LAUNCH);

    const turn = process.sendOwnerUtterance('早い質問');
    await flush();
    emitStdout(resultLine({ result: '早い回答' }));

    await expect(turn).resolves.toBe('早い回答');
    expect(clearTimer).toHaveBeenCalledTimes(1);
  });
});
