export interface ConsoleProcess {
    kill: () => void;
}
export declare const ensureConsoleRunning: (configFilePath: string, port: number, dashboardProjectNames: string[]) => Promise<ConsoleProcess | null>;
//# sourceMappingURL=ensureConsoleRunning.d.ts.map