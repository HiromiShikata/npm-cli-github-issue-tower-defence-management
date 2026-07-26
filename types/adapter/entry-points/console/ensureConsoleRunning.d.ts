export interface ConsoleProcess {
    kill: () => void;
}
export declare const ensureConsoleRunning: (configFilePath: string, port: number) => Promise<ConsoleProcess | null>;
//# sourceMappingURL=ensureConsoleRunning.d.ts.map