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

const frameFunctionName = (frame: string): string | null => {
  const match = frame.match(/^at (?:async )?([^\s(]+)/);
  if (!match) {
    return null;
  }
  const name = match[1];
  if (name.startsWith('/') || name.startsWith('file:') || name.includes(':')) {
    return null;
  }
  return name;
};

const isOwnedMethodName = (name: string): boolean =>
  name.includes('.') && !name.includes('<') && !name.startsWith('Object.');

export const extractGraphqlCallSite = (stack: string | undefined): string => {
  if (!stack) {
    return UNKNOWN_GRAPHQL_CALL_SITE;
  }
  const names = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .filter((line) => !line.includes(GRAPHQL_CLIENT_MODULE_NAME))
    .map(frameFunctionName)
    .filter((name): name is string => name !== null);
  const ownedMethodNames = names.filter(isOwnedMethodName);
  const attributable = ownedMethodNames.length > 0 ? ownedMethodNames : names;
  if (attributable.length === 0) {
    return UNKNOWN_GRAPHQL_CALL_SITE;
  }
  return attributable
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
