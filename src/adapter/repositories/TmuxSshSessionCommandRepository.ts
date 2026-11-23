import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  SessionCommandRepository,
  SessionHost,
  SessionReadCommand,
  SessionReadCommandResult,
} from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';

export type ExecuteFileOptions = {
  encoding: 'utf8';
  timeout: number;
  maxBuffer: number;
};

export type ExecuteFile = (
  program: string,
  args: string[],
  options: ExecuteFileOptions,
) => Promise<{ stdout: string }>;

const execFileAsync = promisify(execFile);

const defaultExecuteFile: ExecuteFile = (program, args, options) =>
  execFileAsync(program, args, options).then(({ stdout }) => ({ stdout }));

const SSH_CONNECT_FAILURE_EXIT_CODE = 255;

const COMMAND_TIMEOUT_MILLISECONDS = 10_000;

const COMMAND_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

type ProgramInvocation = { program: string; args: string[] };

export const toProgramInvocation = (
  command: SessionReadCommand,
): ProgramInvocation => {
  switch (command.kind) {
    case 'tmuxHasSession':
      return {
        program: 'tmux',
        args: ['has-session', '-t', `=${command.sessionName}`],
      };
    case 'tmuxCapturePane':
      return {
        program: 'tmux',
        args: [
          'capture-pane',
          '-p',
          '-J',
          '-S',
          '-',
          '-t',
          `=${command.sessionName}:`,
        ],
      };
    case 'tmuxPanePath':
      return {
        program: 'tmux',
        args: [
          'display-message',
          '-p',
          '-t',
          `=${command.sessionName}:`,
          '#{pane_current_path}',
        ],
      };
    case 'realPath':
      return { program: 'realpath', args: ['-e', '--', command.path] };
    case 'fileType':
      return { program: 'stat', args: ['-L', '-c', '%F', '--', command.path] };
    case 'readFileHead':
      return {
        program: 'head',
        args: ['-c', String(command.byteLimit), '--', command.path],
      };
    case 'listDirectory':
      return { program: 'ls', args: ['-1Ap', '--', command.path] };
  }
};

export const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

export const sshInvocation = (
  host: Extract<SessionHost, { kind: 'remote' }>,
  invocation: ProgramInvocation,
): ProgramInvocation => {
  const remoteCommand = [invocation.program, ...invocation.args]
    .map(shellQuote)
    .join(' ');
  return {
    program: 'ssh',
    args: [
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=5',
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-p',
      String(host.port),
      `${host.user}@${host.address}`,
      remoteCommand,
    ],
  };
};

export class TmuxSshSessionCommandRepository implements SessionCommandRepository {
  constructor(private readonly executeFile: ExecuteFile = defaultExecuteFile) {}

  run = async (
    host: SessionHost,
    command: SessionReadCommand,
  ): Promise<SessionReadCommandResult> => {
    if (host.kind === 'unknownRemote') {
      return { kind: 'unreachable' };
    }
    const invocation = toProgramInvocation(command);
    const target =
      host.kind === 'local' ? invocation : sshInvocation(host, invocation);
    try {
      const { stdout } = await this.executeFile(target.program, target.args, {
        encoding: 'utf8',
        timeout: COMMAND_TIMEOUT_MILLISECONDS,
        maxBuffer: COMMAND_MAX_BUFFER_BYTES,
      });
      return { kind: 'exited', exitCode: 0, stdout };
    } catch (error) {
      const exitCode =
        error instanceof Error && 'code' in error ? error.code : null;
      if (typeof exitCode !== 'number') {
        throw error;
      }
      if (
        host.kind === 'remote' &&
        exitCode === SSH_CONNECT_FAILURE_EXIT_CODE
      ) {
        return { kind: 'unreachable' };
      }
      const stdout =
        error instanceof Error && 'stdout' in error ? error.stdout : '';
      return {
        kind: 'exited',
        exitCode,
        stdout: typeof stdout === 'string' ? stdout : '',
      };
    }
  };
}
