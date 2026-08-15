import ky from 'ky';

export const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

export const GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS = 120_000;

export const RATE_LIMIT_SELECTION = 'rateLimit { cost remaining }';

export type GithubGraphqlRateLimit = {
  cost: number;
  remaining: number;
};

export const isMutationOperation = (query: string): boolean =>
  query.trimStart().startsWith('mutation');

export const extractGraphqlOperationName = (query: string): string => {
  const match = query.match(
    /^\s*(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/,
  );
  return match ? match[1] : 'anonymous';
};

export const injectRateLimitSelection = (query: string): string => {
  if (isMutationOperation(query)) {
    return query;
  }
  const lastBraceIndex = query.lastIndexOf('}');
  if (lastBraceIndex === -1) {
    return query;
  }
  return `${query.slice(0, lastBraceIndex)}  ${RATE_LIMIT_SELECTION}\n${query.slice(lastBraceIndex)}`;
};

const extractRateLimit = (
  responseBody: unknown,
): GithubGraphqlRateLimit | null => {
  if (
    typeof responseBody !== 'object' ||
    responseBody === null ||
    !('data' in responseBody)
  ) {
    return null;
  }
  const data: unknown = responseBody.data;
  if (typeof data !== 'object' || data === null || !('rateLimit' in data)) {
    return null;
  }
  const rateLimit: unknown = data.rateLimit;
  if (
    typeof rateLimit !== 'object' ||
    rateLimit === null ||
    !('cost' in rateLimit) ||
    !('remaining' in rateLimit)
  ) {
    return null;
  }
  const { cost, remaining } = rateLimit;
  if (typeof cost !== 'number' || typeof remaining !== 'number') {
    return null;
  }
  return { cost, remaining };
};

export const GRAPHQL_CALL_SITE_FRAME_COUNT = 3;

export const GRAPHQL_CALL_SITE_SEPARATOR = '<-';

export const UNKNOWN_GRAPHQL_CALL_SITE = 'unknown';

const GRAPHQL_CLIENT_MODULE_NAME = 'githubGraphqlClient';

const FRAME_LOCATION_PATTERN = /\(?([^()\s]+):\d+:\d+\)?$/;

const MODULE_FILE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

const TEST_MODULE_SUFFIX_PATTERN = /\.(?:test|spec)$/;

export const frameModuleName = (frame: string): string | null => {
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

export const extractGraphqlCallSite = (stack: string | undefined): string => {
  if (!stack) {
    return UNKNOWN_GRAPHQL_CALL_SITE;
  }
  const moduleNames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .map(frameModuleName)
    .filter((moduleName): moduleName is string => moduleName !== null)
    .filter(
      (moduleName, index, allModuleNames) =>
        allModuleNames[index - 1] !== moduleName,
    );
  if (moduleNames.length === 0) {
    return UNKNOWN_GRAPHQL_CALL_SITE;
  }
  return moduleNames
    .slice(0, GRAPHQL_CALL_SITE_FRAME_COUNT)
    .join(GRAPHQL_CALL_SITE_SEPARATOR);
};

export const captureGraphqlCallSite = (): string =>
  extractGraphqlCallSite(new Error().stack);

export const logGithubGraphqlCost = (params: {
  query: string;
  responseBody: unknown;
  callSite?: string;
  now?: () => Date;
}): void => {
  const rateLimit = extractRateLimit(params.responseBody);
  if (!rateLimit) {
    return;
  }
  const now = params.now ?? (() => new Date());
  const callSite = params.callSite ?? UNKNOWN_GRAPHQL_CALL_SITE;
  console.log(
    `${now().toISOString()} githubGraphqlClient: query=${extractGraphqlOperationName(params.query)} cost=${rateLimit.cost} remaining=${rateLimit.remaining} caller=${callSite}`,
  );
};

export const postGithubGraphqlJson = async <T>(params: {
  ghToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> => {
  const callSite = captureGraphqlCallSite();
  const response = await ky
    .post(GITHUB_GRAPHQL_ENDPOINT, {
      json: {
        query: injectRateLimitSelection(params.query),
        ...(params.variables !== undefined
          ? { variables: params.variables }
          : {}),
      },
      headers: {
        Authorization: `Bearer ${params.ghToken}`,
      },
    })
    .json<T>();
  logGithubGraphqlCost({
    query: params.query,
    responseBody: response,
    callSite,
  });
  return response;
};

export const fetchGithubGraphql = async (params: {
  ghToken: string;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<Response> => {
  const callSite = captureGraphqlCallSite();
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.ghToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: injectRateLimitSelection(params.query),
      variables: params.variables,
    }),
    signal: AbortSignal.timeout(
      params.timeoutMs ?? GITHUB_GRAPHQL_REQUEST_TIMEOUT_MS,
    ),
  });
  if (response.ok) {
    const responseBody: unknown = await response
      .clone()
      .json()
      .catch((): null => null);
    logGithubGraphqlCost({
      query: params.query,
      responseBody,
      callSite,
    });
  }
  return response;
};
