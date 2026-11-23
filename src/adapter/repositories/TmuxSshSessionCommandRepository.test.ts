import { SessionReadCommand } from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';
import {
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
      name: 'captures the last lines of the pane of an exact session',
      command: {
        kind: 'tmuxCapturePane',
        sessionName: 'session-a',
        lineCount: 80,
      },
      expected: {
        program: 'tmux',
        args: ['capture-pane', '-p', '-J', '-S', '-80', '-t', '=session-a:'],
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
