"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGithubGraphql = exports.postGithubGraphqlJson = exports.logGithubGraphqlCost = exports.captureGraphqlCallSite = exports.extractGraphqlCallSite = exports.UNKNOWN_GRAPHQL_CALL_SITE = exports.GRAPHQL_CALL_SITE_SEPARATOR = exports.GRAPHQL_CALL_SITE_FRAME_COUNT = exports.injectRateLimitSelection = exports.extractGraphqlOperationName = exports.isMutationOperation = exports.RATE_LIMIT_SELECTION = exports.GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS = exports.GITHUB_GRAPHQL_ENDPOINT = void 0;
const ky_1 = __importDefault(require("ky"));
exports.GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
exports.GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS = 120000;
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
exports.GRAPHQL_CALL_SITE_FRAME_COUNT = 3;
exports.GRAPHQL_CALL_SITE_SEPARATOR = '<-';
exports.UNKNOWN_GRAPHQL_CALL_SITE = 'unknown';
const GRAPHQL_CLIENT_MODULE_NAME = 'githubGraphqlClient';
const FRAME_LOCATION_PATTERN = /\(?([^()\s]+):\d+:\d+\)?$/;
const MODULE_FILE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const TEST_MODULE_SUFFIX_PATTERN = /\.(?:test|spec)$/;
const frameModuleName = (frame) => {
    const match = frame.match(FRAME_LOCATION_PATTERN);
    if (!match) {
        return null;
    }
    const location = match[1];
    if (location.startsWith('node:') || location.includes('/node_modules/')) {
        return null;
    }
    const fileName = location.split('/').slice(-1)[0];
    const moduleName = fileName
        .replace(MODULE_FILE_EXTENSION_PATTERN, '')
        .replace(TEST_MODULE_SUFFIX_PATTERN, '');
    if (moduleName.length === 0 || moduleName === GRAPHQL_CLIENT_MODULE_NAME) {
        return null;
    }
    return moduleName;
};
const extractGraphqlCallSite = (stack) => {
    if (!stack) {
        return exports.UNKNOWN_GRAPHQL_CALL_SITE;
    }
    const moduleNames = stack
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('at '))
        .map(frameModuleName)
        .filter((moduleName) => moduleName !== null)
        .filter((moduleName, index, allModuleNames) => allModuleNames[index - 1] !== moduleName);
    if (moduleNames.length === 0) {
        return exports.UNKNOWN_GRAPHQL_CALL_SITE;
    }
    return moduleNames
        .slice(0, exports.GRAPHQL_CALL_SITE_FRAME_COUNT)
        .join(exports.GRAPHQL_CALL_SITE_SEPARATOR);
};
exports.extractGraphqlCallSite = extractGraphqlCallSite;
const captureGraphqlCallSite = () => (0, exports.extractGraphqlCallSite)(new Error().stack);
exports.captureGraphqlCallSite = captureGraphqlCallSite;
const logGithubGraphqlCost = (params) => {
    const rateLimit = extractRateLimit(params.responseBody);
    if (!rateLimit) {
        return;
    }
    const now = params.now ?? (() => new Date());
    const callSite = params.callSite ?? exports.UNKNOWN_GRAPHQL_CALL_SITE;
    console.log(`${now().toISOString()} githubGraphqlClient: query=${(0, exports.extractGraphqlOperationName)(params.query)} cost=${rateLimit.cost} remaining=${rateLimit.remaining} caller=${callSite}`);
};
exports.logGithubGraphqlCost = logGithubGraphqlCost;
const postGithubGraphqlJson = async (params) => {
    const callSite = (0, exports.captureGraphqlCallSite)();
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
    (0, exports.logGithubGraphqlCost)({
        query: params.query,
        responseBody: response,
        callSite,
    });
    return response;
};
exports.postGithubGraphqlJson = postGithubGraphqlJson;
const fetchGithubGraphql = async (params) => {
    const callSite = (0, exports.captureGraphqlCallSite)();
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
        signal: AbortSignal.timeout(params.timeoutMs ?? exports.GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS),
    });
    if (response.ok) {
        const responseBody = await response
            .clone()
            .json()
            .catch(() => null);
        (0, exports.logGithubGraphqlCost)({
            query: params.query,
            responseBody,
            callSite,
        });
    }
    return response;
};
exports.fetchGithubGraphql = fetchGithubGraphql;
//# sourceMappingURL=githubGraphqlClient.js.map