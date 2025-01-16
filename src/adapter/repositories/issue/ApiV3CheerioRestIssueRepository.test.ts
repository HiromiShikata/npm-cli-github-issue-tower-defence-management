import { mock } from 'jest-mock-extended';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { CheerioIssueRepository } from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

describe('ApiV3CheerioRestIssueRepository', () => {
  describe('convertProjectItemAndCheerioIssueToIssue', () => {
    const testCases: {
      name: string;
      params: Parameters<
        ApiV3CheerioRestIssueRepository['convertProjectItemAndCheerioIssueToIssue']
      >;
      expected: Awaited<
        ReturnType<
          ApiV3CheerioRestIssueRepository['convertProjectItemAndCheerioIssueToIssue']
        >
      >;
    }[] = [
      {
        name: 'normal case',
        params: [
          {
            id: 'test-id-1',
            nameWithOwner: 'HiromiShikata/test-repository',
            number: 38,
            title: 'test-title',
            state: 'OPEN',
            url: 'https://github.com/HiromiShikata/test-repository/issues/38',
            body: 'test-body',
            customFields: [
              { name: 'nextActionDate', value: '2000-01-01' },
              { name: 'nextActionHour', value: '1' },
              { name: 'remainingEstimationMinutes', value: '60' },
              { name: 'story', value: 'test-story' },
              { name: 'status', value: 'test-status' },
            ],
          },
          {
            url: 'https://github.com/HiromiShikata/test-repository/issues/38',
            title: 'test-title',
            status: 'test-status',
            assignees: [],
            labels: [],
            project: '',
            statusTimeline: [],
            inProgressTimeline: [],
            createdAt: new Date('2000-01-01'),
          },
        ],
        expected: {
          assignees: [],
          body: 'test-body',
          estimationMinutes: null,
          isPr: false,
          itemId: 'test-id-1',
          labels: [],
          nameWithOwner: 'HiromiShikata/test-repository',
          nextActionDate: new Date('2000-01-01'),
          nextActionHour: 1,
          number: 38,
          org: 'HiromiShikata',
          repo: 'test-repository',
          state: 'OPEN',
          status: 'test-status',
          story: 'test-story',
          title: 'test-title',
          url: 'https://github.com/HiromiShikata/test-repository/issues/38',
          workingTimeline: [],
          dependedIssueUrls: [],
          completionDate50PercentConfidence: null,
          isInProgress: false,
          isClosed: false,
          createdAt: new Date('2000-01-01'),
        },
      },
    ];
    test.each(testCases)('%s', async (arg) => {
      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.convertProjectItemAndCheerioIssueToIssue(
        ...arg.params,
      );
      expect(result).toEqual(arg.expected);
    });
  });
  describe('getAllIssuesFromCache', () => {
    const testCases: {
      name: string;
      params: Parameters<
        ApiV3CheerioRestIssueRepository['getAllIssuesFromCache']
      >;
      expected: Awaited<
        ReturnType<ApiV3CheerioRestIssueRepository['getAllIssuesFromCache']>
      >;
    }[] = [
      {
        name: 'normal case',
        params: ['test-key', 1],
        expected: null,
      },
    ];
    test.each(testCases)('%s', async (arg) => {
      const { repository, localStorageCacheRepository } =
        createApiV3CheerioRestIssueRepository();
      localStorageCacheRepository.getLatest.mockResolvedValue({
        timestamp: new Date('2000-01-01'),
        value: [],
      });
      const result = await repository.getAllIssuesFromCache(...arg.params);
      expect(result).toEqual(arg.expected);
    });
  });
  describe('getAllIssues', () => {
    const testCases: {
      name: string;
      params: Parameters<ApiV3CheerioRestIssueRepository['getAllIssues']>;
      expected: Awaited<
        ReturnType<ApiV3CheerioRestIssueRepository['getAllIssues']>
      >;
    }[] = [
      {
        name: 'normal case',
        params: ['test-project-id', 1],
        expected: { issues: [], cacheUsed: false },
      },
    ];
    test.each(testCases)('%s', async (arg) => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
      } = createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.set.mockResolvedValue();
      const result = await repository.getAllIssues(...arg.params);
      expect(result).toEqual(arg.expected);
    });
  });

  const createApiV3CheerioRestIssueRepository = () => {
    const apiV3IssueRepository = mock<ApiV3IssueRepository>();
    const cheerioIssueRepository = mock<CheerioIssueRepository>();
    const restIssueRepository = mock<RestIssueRepository>();
    const graphqlProjectItemRepository = mock<GraphqlProjectItemRepository>();
    const localStorageCacheRepository = mock<LocalStorageCacheRepository>();
    const localStorageRepository = mock<LocalStorageRepository>();

    const repository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      cheerioIssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      localStorageRepository,
    );
    restIssueRepository.getIssue.mockResolvedValue({
      labels: [],
      assignees: [],
      title: 'test-title',
      body: 'test-body',
      number: 38,
      state: 'OPEN',
      created_at: '2000-01-01T00:00:00Z',
    });
    return {
      repository,
      apiV3IssueRepository,
      cheerioIssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
    };
  };
});
