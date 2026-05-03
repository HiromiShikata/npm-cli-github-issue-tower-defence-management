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
      mockPost.mockClear();
    });

    it('should sleep between paginated requests to avoid 403', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
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
        '',
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
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
      ).rejects.toThrow('GitHub GraphQL errors: RATE_LIMITED');
    });

    it('should throw when node is null in response', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
        'dummy-token',
      );

      mockPost.mockReturnValueOnce(
        mockJsonResponse({
          data: { node: null },
        }),
      );

      await expect(
        repository.fetchProjectItems('test-project-id'),
      ).rejects.toThrow('No data returned from GitHub API');
    });

    it('should throw when accumulated nodes count does not match totalCount', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
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
        'fetchProjectItems: expected 5 items but accumulated 1',
      );
    });

    it('should throw when page has no nodes but totalCount is positive', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
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
        '',
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
  });

  describe('getProjectItemFields', () => {
    afterEach(() => {
      mockPost.mockClear();
    });

    it('should return project item fields', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
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
