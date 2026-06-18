export declare const CONSOLE_LIST_TAB_NAMES: string[];
export type ConsoleDataRoute = {
    kind: 'list';
    pjcode: string;
    tab: string;
} | {
    kind: 'detail';
    pjcode: string;
    tab: string;
    key: string;
} | {
    kind: 'in-tmux';
    pjcode: string;
    relativePath: string;
};
export declare const parseConsoleDataRoute: (requestPath: string) => ConsoleDataRoute | null;
export type ConsoleDataResponse = {
    statusCode: number;
    contentType: string;
    body: string;
};
export declare const buildConsoleDataResponse: (consoleDataOutputDir: string, route: ConsoleDataRoute) => ConsoleDataResponse;
//# sourceMappingURL=consoleDataDelivery.d.ts.map