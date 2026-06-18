import * as http from 'http';
export declare const DEFAULT_CONSOLE_PORT = 9981;
export declare const CONSOLE_TOKEN_HEADER = "x-pv-token";
export declare const hasDotSegment: (requestPath: string) => boolean;
export declare const requiresToken: (requestPath: string) => boolean;
export declare const isTokenValid: (expectedToken: string, providedToken: string | null) => boolean;
export declare const extractProvidedToken: (queryToken: string | string[] | null, headerToken: string | string[] | undefined) => string | null;
export type ConsoleServerOptions = {
    accessToken: string;
    uiDistDir: string;
    consoleDataOutputDir: string | null;
};
export declare const handleConsoleRequest: (options: ConsoleServerOptions, request: http.IncomingMessage, response: http.ServerResponse) => void;
export declare const createConsoleServer: (options: ConsoleServerOptions) => http.Server;
export type StartConsoleServerOptions = ConsoleServerOptions & {
    port: number;
};
export declare const startConsoleServer: (options: StartConsoleServerOptions) => Promise<http.Server>;
//# sourceMappingURL=consoleServer.d.ts.map