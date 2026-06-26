import * as http from 'http';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IssueTitleStateCache } from './consoleReadApi';
import { ConsoleProjectResolver } from './consoleOperationApi';
import { ImageFetcher } from './consoleImageProxy';
export declare const DEFAULT_WEB_PORT = 9981;
export declare const CONSOLE_TOKEN_HEADER = "x-pv-token";
export declare const hasDotSegment: (requestPath: string) => boolean;
export declare const requiresToken: (requestPath: string) => boolean;
export declare const isConsoleAppRoute: (requestPath: string) => boolean;
export declare const isTokenValid: (expectedToken: string, providedToken: string | null) => boolean;
export declare const extractProvidedToken: (queryToken: string | string[] | null, headerToken: string | string[] | undefined) => string | null;
export type WebServerOptions = {
    accessToken: string;
    uiDistDir: string;
    consoleDataOutputDir: string | null;
    inTmuxDataDir: string | null;
    dashboardDir: string | null;
    githubToken?: string | null;
    imageFetcher?: ImageFetcher | null;
    issueRepository?: IssueRepository | null;
    resolveProject?: ConsoleProjectResolver | null;
    issueTitleStateCache?: IssueTitleStateCache | null;
};
export declare const DASHBOARD_REQUEST_PATH = "/tdpm.txt";
export declare const IMAGE_PROXY_REQUEST_PATH = "/api/img";
export declare const resolveDashboardFilePath: (dashboardDir: string, requestPath: string) => string | null;
export declare const resolveFlatInTmuxFilePath: (inTmuxDataDir: string, requestPath: string) => string | null;
export declare const handleWebRequest: (options: WebServerOptions, request: http.IncomingMessage, response: http.ServerResponse) => Promise<void>;
export declare const createWebServer: (options: WebServerOptions) => http.Server;
export type StartWebServerOptions = WebServerOptions & {
    port: number;
};
export declare const startWebServer: (options: StartWebServerOptions) => Promise<http.Server>;
//# sourceMappingURL=webServer.d.ts.map