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
  });
});
