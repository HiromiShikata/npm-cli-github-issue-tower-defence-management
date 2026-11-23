import {
  SessionHost,
  SessionReadCommand,
} from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';
import {
  ExecuteFile,
  TmuxSshSessionCommandRepository,
  shellQuote,
  sshInvocation,
  toProgramInvocation,
} from './TmuxSshSessionCommandRepository';

describe('toProgramInvocation', () => {
  it.each<{
    name: string;
    command: SessionReadCommand;
    expected: { program: string; args: string[] };
  }>([
    {
      name: 'checks an exact tmux session with has-session',
      command: { kind: 'tmuxHasSession', sessionName: 'session-a' },
      expected: {
        program: 'tmux',
        args: ['has-session', '-t', '=session-a'],
      },
    },
    {
      name: 'captures the whole history and visible rows of an exact session, so the caller can keep an exact line count',
      command: {
        kind: 'tmuxCapturePane',
        sessionName: 'session-a',
      },
      expected: {
        program: 'tmux',
        args: ['capture-pane', '-p', '-J', '-S', '-', '-t', '=session-a:'],
      },
    },
    {
      name: 'reads the current path of the pane with display-message',
      command: { kind: 'tmuxPanePath', sessionName: 'session-a' },
      expected: {
        program: 'tmux',
        args: [
          'display-message',
          '-p',
          '-t',
          '=session-a:',
          '#{pane_current_path}',
        ],
      },
    },
    {
      name: 'resolves a real path with realpath, refusing a missing path',
      command: { kind: 'realPath', path: '/work/project' },
      expected: {
        program: 'realpath',
        args: ['-e', '--', '/work/project'],
      },
    },
    {
      name: 'reads the file type of the resolved path',
      command: { kind: 'fileType', path: '/work/project/a.txt' },
      expected: {
        program: 'stat',
        args: ['-L', '-c', '%F', '--', '/work/project/a.txt'],
      },
    },
    {
      name: 'reads the head of a file with a byte limit',
      command: {
        kind: 'readFileHead',
        path: '/work/project/a.txt',
        byteLimit: 16385,
      },
      expected: {
        program: 'head',
        args: ['-c', '16385', '--', '/work/project/a.txt'],
      },
    },
    {
      name: 'lists a directory without touching its entries',
      command: { kind: 'listDirectory', path: '/work/project' },
      expected: {
        program: 'ls',
        args: ['-1Ap', '--', '/work/project'],
      },
    },
  ])('$name', ({ command, expected }) => {
    expect(toProgramInvocation(command)).toEqual(expected);
  });
});

describe('shellQuote', () => {
  it.each([
    {
      name: 'wraps a plain value in single quotes',
      value: 'abc',
      expected: "'abc'",
    },
    {
      name: 'keeps spaces literal inside the quotes',
      value: 'a b',
      expected: "'a b'",
    },
    {
      name: 'escapes an embedded single quote',
      value: "it's",
      expected: "'it'\\''s'",
    },
    {
      name: 'keeps shell metacharacters literal',
      value: '$(rm -rf /); `x`',
      expected: "'$(rm -rf /); `x`'",
    },
  ])('$name', ({ value, expected }) => {
    expect(shellQuote(value)).toBe(expected);
  });
});

describe('sshInvocation', () => {
  it('runs the quoted read command on the listed host with batch-mode ssh', () => {
    expect(
      sshInvocation(
        {
          kind: 'remote',
          name: 'example-worker',
          address: 'worker.example.invalid',
          port: 2222,
          user: 'worker',
        },
        {
          program: 'realpath',
          args: ['-e', '--', "/work/it's here"],
        },
      ),
    ).toEqual({
      program: 'ssh',
      args: [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=5',
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-p',
        '2222',
        'worker@worker.example.invalid',
        "'realpath' '-e' '--' '/work/it'\\''s here'",
      ],
    });
  });
});

const LOCAL_HOST: SessionHost = { kind: 'local' };

const REMOTE_HOST: SessionHost = {
  kind: 'remote',
  name: 'example-worker',
  address: 'worker.example.invalid',
  port: 2222,
  user: 'worker',
};

const HAS_SESSION_COMMAND: SessionReadCommand = {
  kind: 'tmuxHasSession',
  sessionName: 'session-a',
};

type ExecuteOutcome = { stdout: string } | Error;

const recordingExecute = (
  outcome: ExecuteOutcome,
): { execute: ExecuteFile; calls: { program: string; args: string[] }[] } => {
  const calls: { program: string; args: string[] }[] = [];
  const execute: ExecuteFile = (program: string, args: string[]) => {
    calls.push({ program, args });
    return outcome instanceof Error
      ? Promise.reject(outcome)
      : Promise.resolve(outcome);
  };
  return { execute, calls };
};

const failureWith = (fields: Record<string, unknown>): Error =>
  Object.assign(new Error('command failed'), fields);

describe('TmuxSshSessionCommandRepository.run', () => {
  it.each<{
    name: string;
    host: SessionHost;
    outcome: ExecuteOutcome;
    expected: unknown;
  }>([
    {
      name: 'returns the stdout with exit code 0 when the command succeeds',
      host: LOCAL_HOST,
      outcome: { stdout: 'ok\n' },
      expected: { kind: 'exited', exitCode: 0, stdout: 'ok\n' },
    },
    {
      name: 'returns a non-zero local exit code with its stdout, for example no tmux session',
      host: LOCAL_HOST,
      outcome: failureWith({ code: 1, stdout: 'partial' }),
      expected: { kind: 'exited', exitCode: 1, stdout: 'partial' },
    },
    {
      name: 'returns exit code 255 locally as an ordinary exit, not as unreachable',
      host: LOCAL_HOST,
      outcome: failureWith({ code: 255, stdout: '' }),
      expected: { kind: 'exited', exitCode: 255, stdout: '' },
    },
    {
      name: 'maps ssh exit code 255 on a remote host to unreachable',
      host: REMOTE_HOST,
      outcome: failureWith({ code: 255, stdout: '' }),
      expected: { kind: 'unreachable' },
    },
    {
      name: 'returns a remote non-255 exit code as an ordinary exit',
      host: REMOTE_HOST,
      outcome: failureWith({ code: 1, stdout: 'remote partial' }),
      expected: { kind: 'exited', exitCode: 1, stdout: 'remote partial' },
    },
    {
      name: 'uses an empty stdout when the failure carries none',
      host: LOCAL_HOST,
      outcome: failureWith({ code: 2 }),
      expected: { kind: 'exited', exitCode: 2, stdout: '' },
    },
    {
      name: 'uses an empty stdout when the failure stdout is not a string',
      host: LOCAL_HOST,
      outcome: failureWith({ code: 2, stdout: 5 }),
      expected: { kind: 'exited', exitCode: 2, stdout: '' },
    },
  ])('$name', async ({ host, outcome, expected }) => {
    const { execute } = recordingExecute(outcome);
    const repository = new TmuxSshSessionCommandRepository(execute);
    expect(await repository.run(host, HAS_SESSION_COMMAND)).toEqual(expected);
  });

  it.each<{ name: string; outcome: Error }>([
    {
      name: 'rethrows a spawn failure without a numeric exit code, for example tmux missing',
      outcome: failureWith({ code: 'ENOENT' }),
    },
    {
      name: 'rethrows a timeout that carries no numeric exit code',
      outcome: failureWith({ killed: true, signal: 'SIGTERM', code: null }),
    },
  ])('$name', async ({ outcome }) => {
    const { execute } = recordingExecute(outcome);
    const repository = new TmuxSshSessionCommandRepository(execute);
    await expect(repository.run(LOCAL_HOST, HAS_SESSION_COMMAND)).rejects.toBe(
      outcome,
    );
  });

  it('answers unreachable for an unknown remote host without running anything', async () => {
    const { execute, calls } = recordingExecute({ stdout: '' });
    const repository = new TmuxSshSessionCommandRepository(execute);
    expect(
      await repository.run(
        { kind: 'unknownRemote', name: 'unlisted-host' },
        HAS_SESSION_COMMAND,
      ),
    ).toEqual({ kind: 'unreachable' });
    expect(calls).toEqual([]);
  });

  it.each<{
    name: string;
    host: SessionHost;
    expectedProgram: string;
  }>([
    {
      name: 'runs tmux directly on the local host',
      host: LOCAL_HOST,
      expectedProgram: 'tmux',
    },
    {
      name: 'runs tmux through ssh on a remote host',
      host: REMOTE_HOST,
      expectedProgram: 'ssh',
    },
  ])('$name', async ({ host, expectedProgram }) => {
    const { execute, calls } = recordingExecute({ stdout: '' });
    const repository = new TmuxSshSessionCommandRepository(execute);
    await repository.run(host, HAS_SESSION_COMMAND);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.program).toBe(expectedProgram);
  });
});

describe('toProgramInvocation for read-only git commands', () => {
  it.each<{
    name: string;
    command: SessionReadCommand;
    expected: { program: string; args: string[] };
  }>([
    {
      name: 'asks git for the work tree top level of a folder',
      command: { kind: 'gitTopLevel', folderPath: '/work/project' },
      expected: {
        program: 'git',
        args: ['-C', '/work/project', 'rev-parse', '--show-toplevel'],
      },
    },
    {
      name: 'lists the tracked files of a work tree, NUL separated',
      command: { kind: 'gitTrackedFiles', topLevelPath: '/work/project' },
      expected: {
        program: 'git',
        args: ['-C', '/work/project', 'ls-files', '-z'],
      },
    },
  ])('$name', ({ command, expected }) => {
    expect(toProgramInvocation(command)).toEqual(expected);
  });
});
