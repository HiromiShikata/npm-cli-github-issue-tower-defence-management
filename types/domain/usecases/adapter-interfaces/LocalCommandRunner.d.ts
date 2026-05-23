export interface LocalCommandRunnerOptions {
    env?: Record<string, string>;
}
export interface LocalCommandRunner {
    runCommand(program: string, args: string[], options?: LocalCommandRunnerOptions): Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>;
}
//# sourceMappingURL=LocalCommandRunner.d.ts.map