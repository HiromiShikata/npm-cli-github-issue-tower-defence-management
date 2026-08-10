import {
  LocalCommandRunner,
  LocalCommandRunnerOptions,
} from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { execFile } from 'child_process';
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
    const execOptions: Parameters<typeof execFileAsync>[2] = {
      encoding: 'utf8',
      maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    };
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
        }
        return {
          stdout: String(error.stdout),
          stderr: String(error.stderr),
          exitCode: typeof error.code === 'number' ? error.code : 1,
        };
      }
      throw error;
    }
  }
}
