export declare const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
export declare const GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS = 120000;
export declare const RATE_LIMIT_SELECTION = "rateLimit { cost remaining }";
export type GithubGraphqlRateLimit = {
    cost: number;
    remaining: number;
};
export declare const isMutationOperation: (query: string) => boolean;
export declare const extractGraphqlOperationName: (query: string) => string;
export declare const injectRateLimitSelection: (query: string) => string;
export declare const GRAPHQL_CALL_SITE_FRAME_COUNT = 3;
export declare const GRAPHQL_CALL_SITE_SEPARATOR = "<-";
export declare const UNKNOWN_GRAPHQL_CALL_SITE = "unknown";
export declare const extractGraphqlCallSite: (stack: string | undefined, modulePath?: string) => string;
export declare const captureGraphqlCallSite: () => string;
export declare const logGithubGraphqlCost: (params: {
    query: string;
    responseBody: unknown;
    callSite?: string;
    now?: () => Date;
}) => void;
export declare const postGithubGraphqlJson: <T>(params: {
    ghToken: string;
    query: string;
    variables?: Record<string, unknown>;
}) => Promise<T>;
export declare const fetchGithubGraphql: (params: {
    ghToken: string;
    query: string;
    variables?: Record<string, unknown>;
    timeoutMs?: number;
}) => Promise<Response>;
//# sourceMappingURL=githubGraphqlClient.d.ts.map