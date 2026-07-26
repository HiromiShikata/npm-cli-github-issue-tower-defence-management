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

export const logGithubGraphqlCost = (
  query: string,
  responseBody: unknown,
): void => {
  const rateLimit = extractRateLimit(responseBody);
  if (!rateLimit) {
    return;
  }
  console.log(
    `githubGraphqlClient: query=${extractGraphqlOperationName(query)} cost=${rateLimit.cost} remaining=${rateLimit.remaining}`,
  );
};

export const postGithubGraphqlJson = async <T>(params: {
  ghToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> => {
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
  logGithubGraphqlCost(params.query, response);
  return response;
};

export const fetchGithubGraphql = async (params: {
  ghToken: string;
  query: string;
  variables?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<Response> => {
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
    logGithubGraphqlCost(params.query, responseBody);
  }
  return response;
};
