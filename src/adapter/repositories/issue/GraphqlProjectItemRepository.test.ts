const mockPost = jest.fn();

jest.mock('ky', () => {
  const actualKy: typeof import('ky') = jest.requireActual('ky');
  return {
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
    HTTPError: actualKy.HTTPError,
    __esModule: true,
  };
});

import { HTTPError } from 'ky';
import {
  GraphqlProjectItemRepository,
  PAGINATION_DELAY_MS,
  RATE_LIMIT_MAX_RETRIES,
  callWithRateLimitRetry,
} from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const makeHttpError = (
  status: number,
  headers: Record<string, string> = {},
): HTTPError => {
  const response = new Response('rate limited', {
    status,
    headers,
  });
  const request = new Request('https://api.github.com/graphql');
  const normalizedOptions: ConstructorParameters<typeof HTTPError>[2] = {
    method: 'post',
    retry: {},
    prefix: '',
    onDownloadProgress: undefined,
    onUploadProgress: undefined,
    context: {},
  };
  return new HTTPError(response, request, normalizedOptions);
};

const mockRejectedJsonResponse = (error: HTTPError) => ({
  json: jest.fn().mockRejectedValue(error),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractRequestedFirstFromMockCall = (
  call: unknown,
): number | undefined => {
  if (!Array.isArray(call)) {
    return undefined;
  }
  const second: unknown = call[1];
  if (!isRecord(second)) {
    return undefined;
  }
  const json: unknown = second.json;
  if (!isRecord(json)) {
    return undefined;
  }
  const variables: unknown = json.variables;
  if (!isRecord(variables)) {
    return undefined;
  }
  const first: unknown = variables.first;
  return typeof first === 'number' ? first : undefined;
};

const extractRequestedQueryFromMockCall = (
  call: unknown,
): string | undefined => {
  if (!Array.isArray(call)) {
    return undefined;
  }
  const second: unknown = call[1];
  if (!isRecord(second)) {
    return undefined;
  }
  const json: unknown = second.json;
  if (!isRecord(json)) {
    return undefined;
  }
  const query: unknown = json.query;
  return typeof query === 'string' ? query : undefined;
};

const extractErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  return '';
};

describe('GraphqlProjectItemRepository', () => {
  const makePageResponse = (
    hasNextPage: boolean,
    endCursor: string,
    totalCount = 2,
  ) =>
    mockJsonResponse({
      data: {
        node: {
          items: {
            totalCount,
            pageInfo: {
              endCursor,
              startCursor: 'cursor-start',
              hasNextPage,
            },
            nodes: [
              {
                id: `item-${endCursor}`,
                fieldValues: {
                  nodes: [
                    {
                      text: 'some text',
                      field: { name: 'Status' },
                    },
                  ],
                },
                content: {
                  repository: { nameWithOwner: 'owner/repo' },
                  number: 1,
                  title: 'Test Issue',
                  state: 'OPEN',
                  url: 'https://github.com/owner/repo/issues/1',
                  body: 'body',
                  createdAt: '2024-01-01T00:00:00Z',
                  labels: { nodes: [] },
                  assignees: { nodes: [] },
                },
              },
            ],
          },
        },
      },
    });

  describe('fetchProjectItems', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      mockPost.mockReset();
    });

    it('should sleep between paginated requests to avoid 403', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockPost
        .mockReturnValueOnce(makePageResponse(true, 'cursor-1'))
        .mockReturnValueOnce(makePageResponse(false, 'cursor-2'));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(PAGINATION_DELAY_MS);
      const result = await resultPromise;

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        PAGINATION_DELAY_MS,
      );
      setTimeoutSpy.mockRestore();
    });

    it('should throw when response contains GraphQL errors alongside partial data', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockImplementation(() =>
        mockJsonResponse({
          data: {
            node: {
              items: {
                totalCount: 1,
                pageInfo: {
                  endCursor: 'cursor-1',
                  startCursor: 'cursor-start',
                  hasNextPage: false,
                },
                nodes: [
                  {
                    id: 'item-partial',
                    fieldValues: { nodes: [] },
                    content: {
                      repository: { nameWithOwner: 'owner/repo' },
                      number: 1,
                      title: 'Partial Issue',
                      state: 'OPEN',
                      url: 'https://github.com/owner/repo/issues/1',
                      body: 'body',
                      createdAt: '2024-01-01T00:00:00Z',
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                    },
                  },
                ],
              },
            },
          },
          errors: [{ message: 'RATE_LIMITED' }],
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow('GitHub GraphQL errors: [{"message":"RATE_LIMITED"}]');
    });

    it('should throw when data is null in response', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockImplementation(() =>
        mockJsonResponse({
          data: null,
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow('No data returned from GitHub API');
    });

    it('should throw when node is null in response', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockImplementation(() =>
        mockJsonResponse({
          data: { node: null },
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow('No data returned from GitHub API');
    });

    it('should throw when a returned page contains nodes, declares hasNextPage=false, yet totalCount still indicates more items remain', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            node: {
              items: {
                totalCount: 5,
                pageInfo: {
                  endCursor: 'cursor-1',
                  startCursor: 'cursor-start',
                  hasNextPage: false,
                },
                nodes: [
                  {
                    id: 'item-1',
                    fieldValues: { nodes: [] },
                    content: {
                      repository: { nameWithOwner: 'owner/repo' },
                      number: 1,
                      title: 'Test Issue',
                      state: 'OPEN',
                      url: 'https://github.com/owner/repo/issues/1',
                      body: 'body',
                      createdAt: '2024-01-01T00:00:00Z',
                      labels: { nodes: [] },
                      assignees: { nodes: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow(
        'fetchProjectItems: page 1 has 1 nodes with hasNextPage=false but only 1/5 items accumulated',
      );
    });

    it('should throw when page has no nodes but totalCount is positive', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            node: {
              items: {
                totalCount: 2,
                pageInfo: {
                  endCursor: 'cursor-1',
                  startCursor: 'cursor-start',
                  hasNextPage: false,
                },
                nodes: [],
              },
            },
          },
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow(
        'fetchProjectItems: expected 2 items but accumulated 0',
      );
    });

    it('should not sleep on first request when there is only one page', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockPost.mockReturnValueOnce(makePageResponse(false, 'cursor-1', 1));

      const result = await repository.fetchProjectItems('test-project-id');

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(
        expect.any(Function),
        PAGINATION_DELAY_MS,
      );
      setTimeoutSpy.mockRestore();
    });

    it('should stringify full response errors payload including extensions when callGraphql throws', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockImplementation(() =>
        mockJsonResponse({
          errors: [
            {
              message: 'Something went wrong while executing your query.',
              path: ['node', 'items', 'nodes', 7, 'id'],
              locations: [{ line: 11, column: 11 }],
              extensions: { code: 'INTERNAL' },
            },
          ],
        }),
      );

      let capturedError: unknown = null;
      await expect(
        repository
          .fetchProjectItems('test-project-id')
          .catch((error: unknown) => {
            capturedError = error;
            throw error;
          }),
      ).rejects.toThrow(/^GitHub GraphQL errors: /);
      expect(capturedError).toBeInstanceOf(Error);
      const message = extractErrorMessage(capturedError);
      expect(message).toContain('"extensions":{"code":"INTERNAL"}');
      expect(message).toContain('"path":["node","items","nodes",7,"id"]');
      expect(message).toContain('"locations":[{"line":11,"column":11}]');
    });

    it('should fall back to half the page size when first=100 fails and first=50 succeeds', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const failingResponse = mockJsonResponse({
        errors: [
          { message: 'Something went wrong while executing your query.' },
        ],
      });
      const successPageResponse = makePageResponse(false, 'cursor-1', 1);

      mockPost
        .mockReturnValueOnce(failingResponse)
        .mockReturnValueOnce(successPageResponse);

      const result = await repository.fetchProjectItems('test-project-id');

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(extractRequestedFirstFromMockCall(mockPost.mock.calls[0])).toBe(
        100,
      );
      expect(extractRequestedFirstFromMockCall(mockPost.mock.calls[1])).toBe(
        50,
      );
    });

    it('should exhaust halving down to first=1 and rethrow the stringified errors payload', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockImplementation(() =>
        mockJsonResponse({
          errors: [
            {
              message: 'Something went wrong while executing your query.',
              extensions: { code: 'INTERNAL' },
            },
          ],
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow(
        /GitHub GraphQL errors: .*"extensions":\{"code":"INTERNAL"\}.*/,
      );

      expect(mockPost).toHaveBeenCalledTimes(7);
      const requestedFirstSeries = mockPost.mock.calls.map((call) =>
        extractRequestedFirstFromMockCall(call),
      );
      expect(requestedFirstSeries).toEqual([100, 50, 25, 12, 6, 3, 1]);
    });

    it('should sleep the 5000ms blanket delay between pages', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockPost
        .mockReturnValueOnce(makePageResponse(true, 'cursor-1'))
        .mockReturnValueOnce(makePageResponse(false, 'cursor-2'));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(PAGINATION_DELAY_MS);
      const result = await resultPromise;

      expect(result).toHaveLength(2);
      expect(PAGINATION_DELAY_MS).toBe(5000);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      setTimeoutSpy.mockRestore();
    });

    it('should back off and retry once when GitHub responds 429, then succeed', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost
        .mockReturnValueOnce(
          mockRejectedJsonResponse(makeHttpError(429, { 'retry-after': '3' })),
        )
        .mockReturnValueOnce(makePageResponse(false, 'cursor-1', 1));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(result).toHaveLength(1);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should honor the retry-after header duration before retrying after a 429', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost
        .mockReturnValueOnce(
          mockRejectedJsonResponse(makeHttpError(429, { 'retry-after': '7' })),
        )
        .mockReturnValueOnce(makePageResponse(false, 'cursor-1', 1));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(6999);
      expect(mockPost).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      const result = await resultPromise;

      expect(result).toHaveLength(1);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should wait until x-ratelimit-reset when 403 has no retry-after and remaining is 0', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const resetEpochSeconds = Math.floor(Date.now() / 1000) + 4;
      mockPost
        .mockReturnValueOnce(
          mockRejectedJsonResponse(
            makeHttpError(403, {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(resetEpochSeconds),
            }),
          ),
        )
        .mockReturnValueOnce(makePageResponse(false, 'cursor-1', 1));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result).toHaveLength(1);
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('should give up and rethrow after exhausting rate-limit retries', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValue(
        mockRejectedJsonResponse(makeHttpError(429, { 'retry-after': '1' })),
      );

      const resultPromise = repository
        .fetchProjectItems('test-project-id')
        .catch((error: unknown) => error);
      await jest.runAllTimersAsync();
      const caught = await resultPromise;

      expect(caught).toBeInstanceOf(HTTPError);
      expect(mockPost).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES + 1);
    }, 30000);

    it('should not let the page-size halving fallback re-issue a rate-limit request', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValue(
        mockRejectedJsonResponse(makeHttpError(429, { 'retry-after': '1' })),
      );

      const resultPromise = repository
        .fetchProjectItems('test-project-id')
        .catch((error: unknown) => error);
      await jest.runAllTimersAsync();
      await resultPromise;

      const requestedFirstSeries = mockPost.mock.calls.map((call) =>
        extractRequestedFirstFromMockCall(call),
      );
      expect(requestedFirstSeries.every((first) => first === 100)).toBe(true);
    }, 30000);
  });

  const extractRequestedVariablesFromMockCall = (
    call: unknown,
  ): Record<string, unknown> | undefined => {
    if (!Array.isArray(call)) {
      return undefined;
    }
    const second: unknown = call[1];
    if (!isRecord(second)) {
      return undefined;
    }
    const json: unknown = second.json;
    if (!isRecord(json)) {
      return undefined;
    }
    const variables: unknown = json.variables;
    return isRecord(variables) ? variables : undefined;
  };

  describe('fetchProjectItemsLight', () => {
    const makeLightPageResponse = (
      hasNextPage: boolean,
      endCursor: string,
      nodes: {
        id: string;
        updatedAt: string;
        content: { url: string; number: number } | null;
      }[],
      totalCount = nodes.length,
    ) =>
      mockJsonResponse({
        data: {
          node: {
            items: {
              totalCount,
              pageInfo: { endCursor, hasNextPage },
              nodes,
            },
          },
        },
      });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      mockPost.mockReset();
    });

    it('requests only id, updatedAt and content url/number without fieldValues and passes the query filter', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );
      mockPost.mockReturnValueOnce(
        makeLightPageResponse(false, 'cursor-1', [
          {
            id: 'PVTI_1',
            updatedAt: '2026-07-07T10:00:00Z',
            content: {
              url: 'https://github.com/o/r/issues/1',
              number: 1,
            },
          },
        ]),
      );

      const result = await repository.fetchProjectItemsLight(
        'test-project-id',
        'updated:>=2026-07-07',
      );

      const sentQuery = extractRequestedQueryFromMockCall(
        mockPost.mock.calls[0],
      );
      expect(sentQuery).toContain('updatedAt');
      expect(sentQuery).toContain('url');
      expect(sentQuery).toContain('number');
      expect(sentQuery).not.toContain('fieldValues');
      const sentVariables = extractRequestedVariablesFromMockCall(
        mockPost.mock.calls[0],
      );
      expect(sentVariables?.query).toBe('updated:>=2026-07-07');
      expect(result).toEqual([
        {
          id: 'PVTI_1',
          updatedAt: '2026-07-07T10:00:00Z',
          url: 'https://github.com/o/r/issues/1',
          number: 1,
        },
      ]);
    });

    it('paginates all pages and accumulates every light item', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );
      mockPost
        .mockReturnValueOnce(
          makeLightPageResponse(
            true,
            'cursor-1',
            [
              {
                id: 'PVTI_1',
                updatedAt: '2026-07-07T10:00:00Z',
                content: { url: 'https://github.com/o/r/issues/1', number: 1 },
              },
            ],
            2,
          ),
        )
        .mockReturnValueOnce(
          makeLightPageResponse(
            false,
            'cursor-2',
            [
              {
                id: 'PVTI_2',
                updatedAt: '2026-07-07T11:00:00Z',
                content: { url: 'https://github.com/o/r/issues/2', number: 2 },
              },
            ],
            2,
          ),
        );

      const resultPromise = repository.fetchProjectItemsLight(
        'test-project-id',
        'updated:>=2026-07-07',
      );
      await jest.advanceTimersByTimeAsync(PAGINATION_DELAY_MS);
      const result = await resultPromise;

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result.map((item) => item.id)).toEqual(['PVTI_1', 'PVTI_2']);
    });

    it('skips nodes whose content has no url (draft items) but still counts them for totalCount', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );
      mockPost.mockReturnValueOnce(
        makeLightPageResponse(
          false,
          'cursor-1',
          [
            {
              id: 'PVTI_draft',
              updatedAt: '2026-07-07T10:00:00Z',
              content: null,
            },
            {
              id: 'PVTI_1',
              updatedAt: '2026-07-07T10:00:00Z',
              content: { url: 'https://github.com/o/r/issues/1', number: 1 },
            },
          ],
          2,
        ),
      );

      const result = await repository.fetchProjectItemsLight(
        'test-project-id',
        'updated:>=2026-07-07',
      );

      expect(result.map((item) => item.id)).toEqual(['PVTI_1']);
    });
  });

  describe('fetchProjectItemsByIds', () => {
    const makeByIdsResponse = (nodes: (Record<string, unknown> | null)[]) =>
      mockJsonResponse({
        data: {
          nodes,
        },
      });

    const makeDetailNode = (id: string, url: string, title: string) => ({
      id,
      fieldValues: {
        nodes: [
          {
            name: 'In Progress',
            field: { name: 'Status' },
          },
        ],
      },
      content: {
        repository: { nameWithOwner: 'o/r' },
        number: 1,
        title,
        state: 'OPEN',
        url,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-07T10:00:00Z',
        author: { login: 'octocat' },
        labels: { nodes: [{ name: 'bug' }] },
        assignees: { nodes: [{ login: 'octocat' }] },
      },
    });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      mockPost.mockReset();
    });

    it('returns an empty array and makes no request when ids is empty', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );

      const result = await repository.fetchProjectItemsByIds([]);

      expect(result).toEqual([]);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('fetches full detail via nodes(ids:) and maps each to a ProjectItem', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );
      mockPost.mockReturnValueOnce(
        makeByIdsResponse([
          makeDetailNode('PVTI_1', 'https://github.com/o/r/issues/1', 'first'),
          null,
        ]),
      );

      const result = await repository.fetchProjectItemsByIds(['PVTI_1', 'bad']);

      const sentQuery = extractRequestedQueryFromMockCall(
        mockPost.mock.calls[0],
      );
      expect(sentQuery).toContain('nodes(ids: $ids)');
      expect(sentQuery).toContain('... on ProjectV2Item');
      expect(sentQuery).toContain('fieldValues');
      const sentVariables = extractRequestedVariablesFromMockCall(
        mockPost.mock.calls[0],
      );
      expect(sentVariables?.ids).toEqual(['PVTI_1', 'bad']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'PVTI_1',
          url: 'https://github.com/o/r/issues/1',
          title: 'first',
          body: null,
          labels: ['bug'],
          assignees: ['octocat'],
          customFields: [{ name: 'Status', value: 'In Progress' }],
        }),
      );
    });

    it('batches ids into groups of at most 100', async () => {
      const repository = new GraphqlProjectItemRepository(
        new LocalStorageRepository(),
        'dummy-token',
      );
      const ids = Array.from(
        { length: 150 },
        (_unused, index) => `PVTI_${index}`,
      );
      mockPost
        .mockReturnValueOnce(makeByIdsResponse([]))
        .mockReturnValueOnce(makeByIdsResponse([]));

      const resultPromise = repository.fetchProjectItemsByIds(ids);
      await jest.advanceTimersByTimeAsync(PAGINATION_DELAY_MS);
      await resultPromise;

      expect(mockPost).toHaveBeenCalledTimes(2);
      const firstBatch = extractRequestedVariablesFromMockCall(
        mockPost.mock.calls[0],
      );
      const secondBatch = extractRequestedVariablesFromMockCall(
        mockPost.mock.calls[1],
      );
      expect(firstBatch?.ids).toHaveLength(100);
      expect(secondBatch?.ids).toHaveLength(50);
    });
  });

  describe('callWithRateLimitRetry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return the result without retrying when the request succeeds', async () => {
      const request = jest.fn().mockResolvedValue('ok');

      const result = await callWithRateLimitRetry(request);

      expect(result).toBe('ok');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('should retry on a 429 then return the eventual success value', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(makeHttpError(429, { 'retry-after': '2' }))
        .mockResolvedValueOnce('recovered');

      const resultPromise = callWithRateLimitRetry(request);
      await jest.advanceTimersByTimeAsync(2000);
      const result = await resultPromise;

      expect(result).toBe('recovered');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should retry on a 403 rate-limit response then succeed', async () => {
      const resetEpochSeconds = Math.floor(Date.now() / 1000) + 3;
      const request = jest
        .fn()
        .mockRejectedValueOnce(
          makeHttpError(403, {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetEpochSeconds),
          }),
        )
        .mockResolvedValueOnce('recovered');

      const resultPromise = callWithRateLimitRetry(request);
      await jest.advanceTimersByTimeAsync(4000);
      const result = await resultPromise;

      expect(result).toBe('recovered');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should not retry a non-rate-limit HTTP error such as 500', async () => {
      const httpError = makeHttpError(500);
      const request = jest.fn().mockRejectedValue(httpError);

      await expect(callWithRateLimitRetry(request)).rejects.toBe(httpError);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('should rethrow immediately for a non-HTTPError', async () => {
      const plainError = new Error('boom');
      const request = jest.fn().mockRejectedValue(plainError);

      await expect(callWithRateLimitRetry(request)).rejects.toBe(plainError);
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('should stop after the maximum number of rate-limit retries', async () => {
      const httpError = makeHttpError(429, { 'retry-after': '1' });
      const request = jest.fn().mockRejectedValue(httpError);

      const resultPromise = callWithRateLimitRetry(request).catch(
        (error: unknown) => error,
      );
      await jest.runAllTimersAsync();
      const caught = await resultPromise;

      expect(caught).toBe(httpError);
      expect(request).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES + 1);
    }, 30000);
  });

  describe('getProjectItemFields', () => {
    afterEach(() => {
      mockPost.mockClear();
    });

    it('should return project item fields', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: {
                projectItems: {
                  nodes: [
                    {
                      id: 'item-1',
                      fieldValues: {
                        nodes: [
                          {
                            __typename: 'ProjectV2ItemFieldDateValue',
                            date: '2024-04-25',
                            field: { name: 'NextActionDate' },
                          },
                          {
                            __typename: 'ProjectV2ItemFieldSingleSelectValue',
                            name: 'In Progress',
                            field: { name: 'Status' },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
      );

      const result = await repository.getProjectItemFields('owner', 'repo', 1);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        {
          fieldName: 'NextActionDate',
          fieldValue: '2024-04-25',
        },
        {
          fieldName: 'Status',
          fieldValue: 'In Progress',
        },
      ]);
    });
  });

  describe('fetchProjectItemByUrl', () => {
    afterEach(() => {
      mockPost.mockClear();
    });

    const makeContentNode = (url: string, number: number, title: string) => ({
      number,
      title,
      state: 'OPEN',
      url,
      body: 'body text',
      createdAt: '2024-01-01T00:00:00Z',
      author: { login: 'octocat' },
      labels: { nodes: [{ name: 'bug' }] },
      assignees: { nodes: [{ login: 'octocat' }] },
      repository: { nameWithOwner: 'owner/repo' },
      projectItems: {
        nodes: [
          {
            id: `item-${number}`,
            fieldValues: {
              nodes: [
                {
                  __typename: 'ProjectV2ItemFieldSingleSelectValue',
                  name: 'Preparation',
                  field: { name: 'Status' },
                },
              ],
            },
          },
        ],
      },
    });

    it('should return project item for an issue URL', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: makeContentNode(
                'https://github.com/owner/repo/issues/7',
                7,
                'Issue Title',
              ),
              pullRequest: null,
            },
          },
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/issues/7',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://github.com/owner/repo/issues/7');
      expect(result?.title).toBe('Issue Title');
      expect(result?.id).toBe('item-7');
      expect(result?.customFields).toEqual([
        { name: 'Status', value: 'Preparation' },
      ]);
    });

    it('should return project item for a pull request URL when repository.issue is null', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: null,
              pullRequest: makeContentNode(
                'https://github.com/owner/repo/pull/9',
                9,
                'PR Title',
              ),
            },
          },
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/pull/9',
      );

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://github.com/owner/repo/pull/9');
      expect(result?.title).toBe('PR Title');
      expect(result?.id).toBe('item-9');
      expect(result?.customFields).toEqual([
        { name: 'Status', value: 'Preparation' },
      ]);
    });

    it('should query both issue and pullRequest fields in a single request', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: null,
              pullRequest: makeContentNode(
                'https://github.com/owner/repo/pull/3',
                3,
                'PR Title',
              ),
            },
          },
        }),
      );

      await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/pull/3',
      );

      const sentQuery = extractRequestedQueryFromMockCall(
        mockPost.mock.calls[0],
      );
      expect(typeof sentQuery).toBe('string');
      expect(sentQuery).toContain('issue(number: $number)');
      expect(sentQuery).toContain('pullRequest(number: $number)');
    });

    it('should return null when neither issue nor pullRequest exists', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: null,
              pullRequest: null,
            },
          },
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/issues/123',
      );

      expect(result).toBeNull();
    });

    it('should return null when repository is null (NOT_FOUND partial result) instead of throwing', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: null,
          },
          errors: [
            {
              type: 'NOT_FOUND',
              path: ['repository'],
              message:
                'Could not resolve to a Repository with the name owner/repo.',
            },
          ],
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/issues/2350',
      );

      expect(result).toBeNull();
    });

    const makeMultiProjectPrNode = (
      url: string,
      number: number,
      nodes: {
        id: string;
        projectId: string;
      }[],
    ) => ({
      number,
      title: 'PR Title',
      state: 'OPEN',
      url,
      body: 'body text',
      createdAt: '2024-01-01T00:00:00Z',
      author: { login: 'octocat' },
      labels: { nodes: [] },
      assignees: { nodes: [] },
      repository: { nameWithOwner: 'owner/repo' },
      projectItems: {
        nodes: nodes.map((node) => ({
          id: node.id,
          project: { id: node.projectId },
          fieldValues: {
            nodes: [
              {
                __typename: 'ProjectV2ItemFieldSingleSelectValue',
                name: 'Preparation',
                field: { name: 'Status' },
              },
            ],
          },
        })),
      },
    });

    it('should select the project item belonging to the given project id when the PR is on multiple projects', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: null,
              pullRequest: makeMultiProjectPrNode(
                'https://github.com/owner/repo/pull/11',
                11,
                [
                  { id: 'item-other-project', projectId: 'project-other' },
                  { id: 'item-current-project', projectId: 'project-current' },
                ],
              ),
            },
          },
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/pull/11',
        'project-current',
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('item-current-project');
    });

    it('should return null and warn instead of throwing when the PR has no project item on the given project', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: {
            repository: {
              issue: null,
              pullRequest: makeMultiProjectPrNode(
                'https://github.com/owner/repo/pull/12',
                12,
                [{ id: 'item-other-project', projectId: 'project-other' }],
              ),
            },
          },
        }),
      );

      const result = await repository.fetchProjectItemByUrl(
        'https://github.com/owner/repo/pull/12',
        'project-current',
      );

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
