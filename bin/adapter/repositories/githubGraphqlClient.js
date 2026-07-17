"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGithubGraphql = exports.postGithubGraphqlJson = exports.logGithubGraphqlCost = exports.injectRateLimitSelection = exports.extractGraphqlOperationName = exports.isMutationOperation = exports.RATE_LIMIT_SELECTION = exports.GITHUB_GRAPHQL_ENDPOINT = void 0;
const ky_1 = __importDefault(require("ky"));
exports.GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
exports.RATE_LIMIT_SELECTION = 'rateLimit { cost remaining }';
const isMutationOperation = (query) => query.trimStart().startsWith('mutation');
exports.isMutationOperation = isMutationOperation;
const extractGraphqlOperationName = (query) => {
    const match = query.match(/^\s*(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
    return match ? match[1] : 'anonymous';
};
exports.extractGraphqlOperationName = extractGraphqlOperationName;
const injectRateLimitSelection = (query) => {
    if ((0, exports.isMutationOperation)(query)) {
        return query;
    }
    const lastBraceIndex = query.lastIndexOf('}');
    if (lastBraceIndex === -1) {
        return query;
    }
    return `${query.slice(0, lastBraceIndex)}  ${exports.RATE_LIMIT_SELECTION}\n${query.slice(lastBraceIndex)}`;
};
exports.injectRateLimitSelection = injectRateLimitSelection;
const extractRateLimit = (responseBody) => {
    if (typeof responseBody !== 'object' ||
        responseBody === null ||
        !('data' in responseBody)) {
        return null;
    }
    const data = responseBody.data;
    if (typeof data !== 'object' || data === null || !('rateLimit' in data)) {
        return null;
    }
    const rateLimit = data.rateLimit;
    if (typeof rateLimit !== 'object' ||
        rateLimit === null ||
        !('cost' in rateLimit) ||
        !('remaining' in rateLimit)) {
        return null;
    }
    const { cost, remaining } = rateLimit;
    if (typeof cost !== 'number' || typeof remaining !== 'number') {
        return null;
    }
    return { cost, remaining };
};
const logGithubGraphqlCost = (query, responseBody) => {
    const rateLimit = extractRateLimit(responseBody);
    if (!rateLimit) {
        return;
    }
    console.log(`githubGraphqlClient: query=${(0, exports.extractGraphqlOperationName)(query)} cost=${rateLimit.cost} remaining=${rateLimit.remaining}`);
};
exports.logGithubGraphqlCost = logGithubGraphqlCost;
const postGithubGraphqlJson = async (params) => {
    const response = await ky_1.default
        .post(exports.GITHUB_GRAPHQL_ENDPOINT, {
        json: {
            query: (0, exports.injectRateLimitSelection)(params.query),
            ...(params.variables !== undefined
                ? { variables: params.variables }
                : {}),
        },
        headers: {
            Authorization: `Bearer ${params.ghToken}`,
        },
    })
        .json();
    (0, exports.logGithubGraphqlCost)(params.query, response);
    return response;
};
exports.postGithubGraphqlJson = postGithubGraphqlJson;
const fetchGithubGraphql = async (params) => {
    const response = await fetch(exports.GITHUB_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${params.ghToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: (0, exports.injectRateLimitSelection)(params.query),
            variables: params.variables,
        }),
    });
    if (response.ok) {
        const responseBody = await response
            .clone()
            .json()
            .catch(() => null);
        (0, exports.logGithubGraphqlCost)(params.query, responseBody);
    }
    return response;
};
exports.fetchGithubGraphql = fetchGithubGraphql;
//# sourceMappingURL=githubGraphqlClient.js.map