const mockPost = jest.fn();

jest.mock('ky', () => ({
  default: {
    post: mockPost,
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

import {
  GITHUB_GRAPHQL_ENDPOINT,
  RATE_LIMIT_SELECTION,
  extractGraphqlOperationName,
  fetchGithubGraphql,
  injectRateLimitSelection,
  isMutationOperation,
  logGithubGraphqlCost,
  postGithubGraphqlJson,
} from './githubGraphqlClient';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const expectRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`Expected an object but got: ${String(value)}`);
  }
  return value;
};

const getMockCallArguments = (
  mock: jest.Mock,
  callIndex: number,
): unknown[] => {
  const call: unknown = mock.mock.calls[callIndex];
  if (!Array.isArray(call)) {
    throw new Error('Expected a recorded mock call');
  }
  return call.map((argument: unknown) => argument);
};

describe('githubGraphqlClient', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('isMutationOperation', () => {
    it('returns true for a mutation operation', () => {
      expect(isMutationOperation('mutation AddItem { x }')).toBe(true);
      expect(isMutationOperation('\n  mutation { x }')).toBe(true);
    });

    it('returns false for query operations', () => {
      expect(isMutationOperation('query GetItem { x }')).toBe(false);
      expect(isMutationOperation('\n  query($a: Int!) { x }')).toBe(false);
    });
  });

  describe('extractGraphqlOperationName', () => {
    it('extracts the operation name from a named query', () => {
      expect(
        extractGraphqlOperationName('query GetProjectItems($id: ID!) { x }'),
      ).toBe('GetProjectItems');
    });

    it('extracts the operation name from a named mutation', () => {
      expect(
        extractGraphqlOperationName('mutation AddIssueToProject { x }'),
      ).toBe('AddIssueToProject');
    });

    it('returns anonymous for an unnamed query', () => {
      expect(extractGraphqlOperationName('query($a: Int!) { x }')).toBe(
        'anonymous',
      );
    });
  });

  describe('injectRateLimitSelection', () => {
    it('injects the rateLimit selection before the closing brace of a query', () => {
      const injected = injectRateLimitSelection(
        'query GetItem($id: ID!) {\n  node(id: $id) { id }\n}',
      );
      expect(injected).toContain(RATE_LIMIT_SELECTION);
      expect(injected.trimEnd().endsWith('}')).toBe(true);
      const rateLimitIndex = injected.indexOf(RATE_LIMIT_SELECTION);
      const lastBraceIndex = injected.lastIndexOf('}');
      expect(rateLimitIndex).toBeLessThan(lastBraceIndex);
    });

    it('does not modify a mutation', () => {
      const mutation = 'mutation AddItem { addItem { id } }';
      expect(injectRateLimitSelection(mutation)).toBe(mutation);
    });

    it('injects into an anonymous query', () => {
      const injected = injectRateLimitSelection(
        '\n  query($a: Int!) {\n    node { id }\n  }\n',
      );
      expect(injected).toContain(RATE_LIMIT_SELECTION);
    });
  });

  describe('logGithubGraphqlCost', () => {
    it('logs one line with query name, cost and remaining', () => {
      logGithubGraphqlCost('query GetProjectItems { x }', {
        data: { rateLimit: { cost: 3, remaining: 4200 } },
      });
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'githubGraphqlClient: query=GetProjectItems cost=3 remaining=4200',
      );
    });

    it('does not log when rateLimit is absent', () => {
      logGithubGraphqlCost('query GetProjectItems { x }', {
        data: { node: null },
      });
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('does not log when the body is not an object', () => {
      logGithubGraphqlCost('query GetProjectItems { x }', undefined);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('postGithubGraphqlJson', () => {
    it('sends the query with the injected rateLimit selection and logs the cost', async () => {
      mockPost.mockReturnValue({
        json: jest.fn().mockResolvedValue({
          data: {
            node: { id: 'x' },
            rateLimit: { cost: 1, remaining: 4999 },
          },
        }),
      });
      const response = await postGithubGraphqlJson<{
        data: { node: { id: string } };
      }>({
        ghToken: 'token-a',
        query: 'query GetItem($id: ID!) { node(id: $id) { id } }',
        variables: { id: 'x' },
      });
      expect(response.data.node.id).toBe('x');
      expect(mockPost).toHaveBeenCalledTimes(1);
      const call = getMockCallArguments(mockPost, 0);
      expect(call[0]).toBe(GITHUB_GRAPHQL_ENDPOINT);
      const options = expectRecord(call[1]);
      const json = expectRecord(options.json);
      const headers = expectRecord(options.headers);
      expect(json.query).toContain(RATE_LIMIT_SELECTION);
      expect(json.variables).toEqual({ id: 'x' });
      expect(headers.Authorization).toBe('Bearer token-a');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'githubGraphqlClient: query=GetItem cost=1 remaining=4999',
      );
    });

    it('sends a mutation unchanged and does not log', async () => {
      mockPost.mockReturnValue({
        json: jest.fn().mockResolvedValue({
          data: { addItem: { id: 'x' } },
        }),
      });
      const mutation = 'mutation AddItem { addItem { id } }';
      await postGithubGraphqlJson({
        ghToken: 'token-a',
        query: mutation,
      });
      const call = getMockCallArguments(mockPost, 0);
      const options = expectRecord(call[1]);
      const json = expectRecord(options.json);
      expect(json.query).toBe(mutation);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('fetchGithubGraphql', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('sends the query with the injected rateLimit selection and logs the cost', async () => {
      const responseBody = {
        data: {
          repository: { issue: null },
          rateLimit: { cost: 2, remaining: 4321 },
        },
      };
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(responseBody), { status: 200 }),
        );
      global.fetch = fetchMock;
      const response = await fetchGithubGraphql({
        ghToken: 'token-b',
        query: 'query PullRequestStatus($a: Int!) { x }',
        variables: { a: 1 },
      });
      expect(response.ok).toBe(true);
      await expect(response.json()).resolves.toEqual(responseBody);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = getMockCallArguments(fetchMock, 0);
      expect(call[0]).toBe(GITHUB_GRAPHQL_ENDPOINT);
      const init = expectRecord(call[1]);
      const headers = expectRecord(init.headers);
      expect(init.method).toBe('POST');
      expect(headers.Authorization).toBe('Bearer token-b');
      if (typeof init.body !== 'string') {
        throw new Error('Expected the request body to be a string');
      }
      const sentBody = expectRecord(JSON.parse(init.body));
      expect(sentBody.query).toContain(RATE_LIMIT_SELECTION);
      expect(sentBody.variables).toEqual({ a: 1 });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'githubGraphqlClient: query=PullRequestStatus cost=2 remaining=4321',
      );
    });

    it('returns the response without logging when the request failed', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(new Response('rate limited', { status: 403 }));
      global.fetch = fetchMock;
      const response = await fetchGithubGraphql({
        ghToken: 'token-b',
        query: 'query PullRequestStatus($a: Int!) { x }',
      });
      expect(response.status).toBe(403);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
