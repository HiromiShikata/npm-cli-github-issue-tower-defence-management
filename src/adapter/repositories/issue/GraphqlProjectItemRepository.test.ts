import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import {
  GraphqlProjectItemRepository,
  PAGINATION_DELAY_MS,
} from './GraphqlProjectItemRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

jest.mock('axios');
const mockAxios = jest.mocked(axios);

const toAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
});

describe('GraphqlProjectItemRepository', () => {
  const makePageResponse = (hasNextPage: boolean, endCursor: string) =>
    toAxiosResponse({
      data: {
        node: {
          items: {
            totalCount: 2,
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
      mockAxios.mockClear();
    });

    it('should sleep between paginated requests to avoid 403', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
        'dummy-token',
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockAxios
        .mockResolvedValueOnce(makePageResponse(true, 'cursor-1'))
        .mockResolvedValueOnce(makePageResponse(false, 'cursor-2'));

      const resultPromise = repository.fetchProjectItems('test-project-id');
      await jest.advanceTimersByTimeAsync(PAGINATION_DELAY_MS);
      const result = await resultPromise;

      expect(mockAxios).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        PAGINATION_DELAY_MS,
      );
      setTimeoutSpy.mockRestore();
    });

    it('should not sleep on first request when there is only one page', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
        'dummy-token',
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      mockAxios.mockResolvedValueOnce(makePageResponse(false, 'cursor-1'));

      const result = await repository.fetchProjectItems('test-project-id');

      expect(mockAxios).toHaveBeenCalledTimes(1);
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
      mockAxios.mockClear();
    });

    it('should return project item fields', async () => {
      const localStorageRepository = new LocalStorageRepository();
      const repository = new GraphqlProjectItemRepository(
        localStorageRepository,
        '',
        'dummy-token',
      );

      mockAxios.mockResolvedValueOnce(
        toAxiosResponse({
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

      expect(mockAxios).toHaveBeenCalledTimes(1);
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
