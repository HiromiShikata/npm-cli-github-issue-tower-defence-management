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
export declare const logGithubGraphqlCost: (query: string, responseBody: unknown) => void;
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