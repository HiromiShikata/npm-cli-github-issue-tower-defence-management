import {
  LocalCommandRunner,
  LocalCommandRunnerOptions,
} from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { execFile, spawn, spawnSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024 * 256;

export class NodeLocalCommandRunner implements LocalCommandRunner {
  async runCommand(
    program: string,
    args: string[],
    options?: LocalCommandRunnerOptions,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    if (options?.killProcessGroup === true) {
      return this.runCommandInProcessGroup(program, args, options);
    }
    const execOptions: Parameters<typeof execFileAsync>[2] = {
      encoding: 'utf8',
      maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    };
    if (program === 'upload-file-to-gh-issue') {
      execOptions.timeout = options?.timeout ?? 300000;
      execOptions.killSignal = options?.killSignal ?? 'SIGTERM';
    }
    if (options?.timeout !== undefined) execOptions.timeout = options.timeout;
    if (options?.killSignal !== undefined)
      execOptions.killSignal = options.killSignal;
    if (options?.env) {
      execOptions.env = { ...process.env, ...options.env };
    }
    try {
      const { stdout, stderr } = await execFileAsync(
        program,
        args,
        execOptions,
      );
      return {
        stdout: String(stdout),
        stderr: String(stderr),
        exitCode: 0,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'stdout' in error &&
        'stderr' in error &&
        'code' in error
      ) {
        if (typeof error.code !== 'number') {
          console.error(
            `${program} did not exit with a numeric status: ${String(error.code)}`,
          );
          throw error;
        }
        return {
          stdout: String(
            Object.getOwnPropertyDescriptor(error, 'stdout')?.value,
          ),
          stderr:
            ('killed' in error && error.killed === true) ||
            ('signal' in error && error.signal === 'SIGTERM')
              ? 'upload timed out'
              : String(Object.getOwnPropertyDescriptor(error, 'stderr')?.value),
          exitCode: error.code,
        };
      }
      throw error;
    }
  }

  private runCommandInProcessGroup(
    program: string,
    args: string[],
    options: LocalCommandRunnerOptions,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, {
        detached: true,
        env:
          options.env === undefined
            ? process.env
            : { ...process.env, ...options.env },
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        if (child.pid !== undefined) {
          try {
            process.kill(-child.pid, options.killSignal ?? 'SIGTERM');
          } catch {
            return;
          }
        }
      }, options.timeout ?? 300000);
      child.once('error', (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code) => {
        globalThis.clearTimeout(timeout);
        resolve({
          stdout,
          stderr: timedOut ? 'upload timed out' : stderr,
          exitCode: code ?? 1,
        });
      });
    });
  }

  spawnInteractive = (program: string, args: string[]): void => {
    spawnSync(program, args, { stdio: 'inherit' });
  };
}
