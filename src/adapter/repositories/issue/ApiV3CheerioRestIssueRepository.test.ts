import { mock } from 'jest-mock-extended';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

describe('ApiV3CheerioRestIssueRepository', () => {
  describe('convertProjectItemToIssue', () => {
    const testCases: {
      name: string;
      params: Parameters<
        ApiV3CheerioRestIssueRepository['convertProjectItemToIssue']
      >;
      expected: Awaited<
        ReturnType<ApiV3CheerioRestIssueRepository['convertProjectItemToIssue']>
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
            labels: [],
            assignees: [],
            createdAt: '2024-01-01T00:00:00Z',
            customFields: [
              { name: 'nextActionDate', value: '2000-01-01' },
              { name: 'nextActionHour', value: '1' },
              { name: 'remainingEstimationMinutes', value: '60' },
              { name: 'story', value: 'test-story' },
              { name: 'status', value: 'test-status' },
            ],
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
          dependedIssueUrls: [],
          completionDate50PercentConfidence: null,
          isInProgress: false,
          isClosed: false,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      },
      {
        name: 'dependedIssueUrls with whitespace around URLs should be trimmed',
        params: [
          {
            id: 'test-id-2',
            nameWithOwner: 'HiromiShikata/test-repository',
            number: 39,
            title: 'test-title-2',
            state: 'OPEN',
            url: 'https://github.com/HiromiShikata/test-repository/issues/39',
            body: 'test-body',
            labels: [],
            assignees: [],
            createdAt: '2024-01-01T00:00:00Z',
            customFields: [
              {
                name: 'DependedIssueUrls',
                value:
                  'https://github.com/HiromiShikata/test-repository/issues/1, https://github.com/HiromiShikata/test-repository/issues/2',
              },
            ],
          },
        ],
        expected: {
          assignees: [],
          body: 'test-body',
          estimationMinutes: null,
          isPr: false,
          itemId: 'test-id-2',
          labels: [],
          nameWithOwner: 'HiromiShikata/test-repository',
          nextActionDate: null,
          nextActionHour: null,
          number: 39,
          org: 'HiromiShikata',
          repo: 'test-repository',
          state: 'OPEN',
          status: null,
          story: null,
          title: 'test-title-2',
          url: 'https://github.com/HiromiShikata/test-repository/issues/39',
          dependedIssueUrls: [
            'https://github.com/HiromiShikata/test-repository/issues/1',
            'https://github.com/HiromiShikata/test-repository/issues/2',
          ],
          completionDate50PercentConfidence: null,
          isInProgress: false,
          isClosed: false,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      },
    ];
    test.each(testCases)('%s', (arg) => {
      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = repository.convertProjectItemToIssue(...arg.params);
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

  describe('updateStatus', () => {
    it('should call graphqlProjectItemRepository.updateProjectField with correct parameters', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.updateProjectField.mockResolvedValue();

      const project = {
        id: 'test-project-id',
        url: 'https://github.com/users/test/projects/1',
        databaseId: 1,
        name: 'test-project',
        status: {
          name: 'Status',
          fieldId: 'test-status-field-id',
          statuses: [],
        },
        nextActionDate: null,
        nextActionHour: null,
        story: null,
        remainingEstimationMinutes: null,
        dependedIssueUrlSeparatedByComma: null,
        completionDate50PercentConfidence: null,
      };
      const issue = {
        nameWithOwner: 'HiromiShikata/test-repository',
        number: 38,
        title: 'test-title',
        state: 'OPEN' as const,
        status: 'test-status',
        story: null,
        nextActionDate: null,
        nextActionHour: null,
        estimationMinutes: null,
        dependedIssueUrls: [],
        completionDate50PercentConfidence: null,
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
        assignees: [],
        labels: [],
        org: 'HiromiShikata',
        repo: 'test-repository',
        body: 'test-body',
        itemId: 'test-item-id',
        isPr: false,
        isInProgress: false,
        isClosed: false,
        createdAt: new Date('2024-01-01'),
      };
      const statusId = 'new-status-id';

      await repository.updateStatus(project, issue, statusId);

      expect(
        graphqlProjectItemRepository.updateProjectField,
      ).toHaveBeenCalledWith(
        'test-project-id',
        'test-status-field-id',
        'test-item-id',
        {
          singleSelectOptionId: 'new-status-id',
        },
      );
    });
  });

  describe('findIssueByTitleAndLabel', () => {
    const testCases: {
      name: string;
      searchResults: { url: string; title: string; number: string }[];
      title: string;
      label: string;
      expected: Awaited<
        ReturnType<ApiV3CheerioRestIssueRepository['findIssueByTitleAndLabel']>
      >;
    }[] = [
      {
        name: 'returns match when issue title exactly equals story name',
        searchResults: [
          {
            url: 'https://github.com/test-org/test-repo/issues/1',
            title: 'Test Story',
            number: '1',
          },
        ],
        title: 'Test Story',
        label: 'story',
        expected: {
          url: 'https://github.com/test-org/test-repo/issues/1',
          title: 'Test Story',
          number: 1,
        },
      },
      {
        name: 'returns match when issue title is a prefix of story name',
        searchResults: [
          {
            url: 'https://github.com/test-org/test-repo/issues/1',
            title: 'Test Story',
            number: '1',
          },
        ],
        title: 'Test Story with suffix',
        label: 'story',
        expected: {
          url: 'https://github.com/test-org/test-repo/issues/1',
          title: 'Test Story',
          number: 1,
        },
      },
      {
        name: 'returns null when no results',
        searchResults: [],
        title: 'Test Story',
        label: 'story',
        expected: null,
      },
      {
        name: 'returns null when result title is longer than story name',
        searchResults: [
          {
            url: 'https://github.com/test-org/test-repo/issues/2',
            title: 'Test Story extra',
            number: '2',
          },
        ],
        title: 'Test Story',
        label: 'story',
        expected: null,
      },
    ];
    test.each(testCases)('$name', async (arg) => {
      const { repository, apiV3IssueRepository } =
        createApiV3CheerioRestIssueRepository();
      apiV3IssueRepository.searchIssueByQuery.mockResolvedValue(
        arg.searchResults,
      );
      const result = await repository.findIssueByTitleAndLabel(
        'test-org',
        'test-repo',
        arg.title,
        arg.label,
      );
      expect(result).toEqual(arg.expected);
    });

    it('uses URL-encoded title with label in the search query', async () => {
      const { repository, apiV3IssueRepository } =
        createApiV3CheerioRestIssueRepository();
      apiV3IssueRepository.searchIssueByQuery.mockResolvedValue([]);
      await repository.findIssueByTitleAndLabel(
        'test-org',
        'test-repo',
        'Story with spaces',
        'story',
      );
      expect(apiV3IssueRepository.searchIssueByQuery).toHaveBeenCalledWith(
        `repo:test-org/test-repo+type:issue+label:story+${encodeURIComponent('"Story with spaces"')}+in:title`,
      );
    });
  });

  const createApiV3CheerioRestIssueRepository = () => {
    const apiV3IssueRepository = mock<ApiV3IssueRepository>();
    const restIssueRepository = mock<RestIssueRepository>();
    const graphqlProjectItemRepository = mock<GraphqlProjectItemRepository>();
    const localStorageCacheRepository = mock<LocalStorageCacheRepository>();
    const localStorageRepository = mock<LocalStorageRepository>();

    const repository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
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
      created_at: '2024-01-01T00:00:00Z',
    });
    return {
      repository,
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
    };
  };
});
