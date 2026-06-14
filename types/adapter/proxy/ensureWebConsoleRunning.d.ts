export declare const WEB_CONSOLE_DEFAULT_PORT = 3737;
export interface WebConsoleProcess {
    kill: () => void;
}
export declare const ensureWebConsoleRunning: (accessKey: string, port?: number) => Promise<WebConsoleProcess | null>;
//# sourceMappingURL=ensureWebConsoleRunning.d.ts.map