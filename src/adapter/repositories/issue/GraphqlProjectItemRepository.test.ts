const mockPost = jest.fn();

jest.mock('ky', () => {
  class MockKyHttpError extends Error {
    public readonly response: { status: number };
    constructor(response: { status: number }) {
      super(`HTTP ${response.status}`);
      this.name = 'HTTPError';
      this.response = response;
    }
  }
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
    HTTPError: MockKyHttpError,
    __esModule: true,
  };
});

import {
  CALL_GRAPHQL_MAX_RETRY_COUNT,
  GraphqlProjectItemRepository,
  PAGINATION_DELAY_MS,
} from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
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
              message: 'Query parse error: unexpected token.',
              path: ['node', 'items', 'nodes', 7, 'id'],
              locations: [{ line: 11, column: 11 }],
              extensions: { code: 'INTERNAL' },
            },
          ],
        }),
      );

      let capturedError: unknown = null;
      const resultPromise = repository
        .fetchProjectItems('test-project-id')
        .catch((error: unknown) => {
          capturedError = error;
          throw error;
        });
      const assertion = expect(resultPromise).rejects.toThrow(
        /^GitHub GraphQL errors: /,
      );
      await jest.runAllTimersAsync();
      await assertion;
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
        errors: [{ message: 'Query parse error: page size too large.' }],
      });
      const successPageResponse = makePageResponse(false, 'cursor-1', 1);

      mockPost
        .mockReturnValueOnce(failingResponse)
        .mockReturnValueOnce(successPageResponse);

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

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
              message: 'Query parse error: page size too large.',
              extensions: { code: 'INTERNAL' },
            },
          ],
        }),
      );

      const resultPromise = repository.fetchProjectItems('test-project-id');
      const assertion = expect(resultPromise).rejects.toThrow(
        /GitHub GraphQL errors: .*"extensions":\{"code":"INTERNAL"\}.*/,
      );
      await jest.runAllTimersAsync();
      await assertion;

      expect(mockPost).toHaveBeenCalledTimes(7);
      const requestedFirstSeries = mockPost.mock.calls.map((call) =>
        extractRequestedFirstFromMockCall(call),
      );
      expect(requestedFirstSeries).toEqual([100, 50, 25, 12, 6, 3, 1]);
    });

    const makeTransientErrorResponse = (requestId: string) =>
      mockJsonResponse({
        data: null,
        errors: [
          {
            message: `Something went wrong while executing your query on 2026-05-27T00:00:00Z. Please include \`${requestId}\` when reporting this issue.`,
          },
        ],
      });

    const expectedTransientErrorMessageFor = (requestId: string) =>
      `Please include \`${requestId}\` when reporting this issue.`;

    it('should retry on transient GitHub GraphQL error and succeed on the next attempt', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      mockPost
        .mockReturnValueOnce(makeTransientErrorResponse('req-attempt-1'))
        .mockReturnValueOnce(makePageResponse(false, 'cursor-after-retry', 1));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      const retryLogCalls = consoleLogSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((line) => /^retry \d+\/\d+:/.test(line));
      expect(retryLogCalls).toHaveLength(1);
      expect(retryLogCalls[0]).toMatch(
        new RegExp(`^retry 1/${CALL_GRAPHQL_MAX_RETRY_COUNT}: `),
      );
      consoleLogSpy.mockRestore();
    });

    it('should retry transient GitHub GraphQL errors up to the configured retry count then rethrow the original error', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const attemptsPerPageSize = CALL_GRAPHQL_MAX_RETRY_COUNT + 1;
      const pageSizes = [100, 50, 25, 12, 6, 3, 1];
      const totalAttempts = attemptsPerPageSize * pageSizes.length;
      let attemptCounter = 0;
      mockPost.mockImplementation(() => {
        attemptCounter += 1;
        return makeTransientErrorResponse(`req-attempt-${attemptCounter}`);
      });

      const resultPromise = repository.fetchProjectItems('test-project-id');
      const assertion = expect(resultPromise).rejects.toThrow(
        expectedTransientErrorMessageFor(`req-attempt-${totalAttempts}`),
      );
      await jest.runAllTimersAsync();
      await assertion;

      expect(mockPost).toHaveBeenCalledTimes(totalAttempts);
      const retryLogCalls = consoleLogSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((line) => /^retry \d+\/\d+:/.test(line));
      expect(retryLogCalls).toHaveLength(
        CALL_GRAPHQL_MAX_RETRY_COUNT * pageSizes.length,
      );
      for (let pageIndex = 0; pageIndex < pageSizes.length; pageIndex++) {
        for (
          let retryNumber = 1;
          retryNumber <= CALL_GRAPHQL_MAX_RETRY_COUNT;
          retryNumber++
        ) {
          const logIndex =
            pageIndex * CALL_GRAPHQL_MAX_RETRY_COUNT + (retryNumber - 1);
          expect(retryLogCalls[logIndex]).toMatch(
            new RegExp(
              `^retry ${retryNumber}/${CALL_GRAPHQL_MAX_RETRY_COUNT}: `,
            ),
          );
        }
      }
      consoleLogSpy.mockRestore();
    });

    it('should not retry a non-transient GitHub GraphQL error', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      mockPost.mockImplementation(() =>
        mockJsonResponse({
          data: null,
          errors: [{ message: 'Bad credentials' }],
        }),
      );

      const resultPromise = repository.fetchProjectItems('test-project-id');
      const assertion = expect(resultPromise).rejects.toThrow(
        /GitHub GraphQL errors: .*Bad credentials.*/,
      );
      await jest.runAllTimersAsync();
      await assertion;

      expect(mockPost).toHaveBeenCalledTimes(7);
      const retryLogCalls = consoleLogSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((line) => /^retry \d+\/\d+:/.test(line));
      expect(retryLogCalls).toHaveLength(0);
      consoleLogSpy.mockRestore();
    });

    it('should not retry or log when the first attempt succeeds', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        'dummy-token',
      );

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      mockPost.mockReturnValueOnce(makePageResponse(false, 'cursor-only', 1));

      const result = await repository.fetchProjectItems('test-project-id');

      expect(result).toHaveLength(1);
      expect(mockPost).toHaveBeenCalledTimes(1);
      const retryLogCalls = consoleLogSpy.mock.calls
        .map((args) => String(args[0]))
        .filter((line) => /^retry \d+\/\d+:/.test(line));
      expect(retryLogCalls).toHaveLength(0);
      consoleLogSpy.mockRestore();
    });
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
});
