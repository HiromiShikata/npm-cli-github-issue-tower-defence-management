export interface LocalCommandRunner {
  runCommand(
    program: string,
    args: string[],
    env?: Record<string, string>,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}
