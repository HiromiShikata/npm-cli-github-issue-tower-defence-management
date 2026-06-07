import { mock } from 'jest-mock-extended';
import { ApiV3CheerioRestIssueRepository } from './ApiV3CheerioRestIssueRepository';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import {
  GraphqlProjectItemRepository,
  ProjectItem,
} from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { Project } from '../../../domain/entities/Project';

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
            author: 'test-author',
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
          author: 'test-author',
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
            author: '',
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
          author: '',
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

  describe('getAllIssues throws when fetchProjectItems throws', () => {
    it('should not write cache and should propagate error when fetchProjectItems throws', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
      } = createApiV3CheerioRestIssueRepository();
      const fetchError = new Error(
        'fetchProjectItems: expected 5 items but accumulated 1',
      );
      graphqlProjectItemRepository.fetchProjectItems.mockRejectedValue(
        fetchError,
      );

      await expect(
        repository.getAllIssues('test-project-id', 1),
      ).rejects.toThrow(fetchError);
      expect(localStorageCacheRepository.set).not.toHaveBeenCalled();
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
        author: '',
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

  describe('setDependedIssueUrl', () => {
    const projectWithDependedIssueUrlField = {
      ...mock<Project>(),
      id: 'test-project-id',
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL separated by comma',
        fieldId: 'depended-field-id',
      },
    };
    const prUrl = 'https://github.com/owner/repo/pull/100';
    const taskIssueUrl = 'https://github.com/owner/repo/issues/1';

    const makeProjectItem = (
      id: string,
      customFields: { name: string; value: string | null }[],
    ): ProjectItem => ({
      ...mock<ProjectItem>(),
      id,
      url: prUrl,
      customFields,
    });

    it('should add the PR to the current project and set the field when the PR has no project item on the current project', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockResolvedValue(
        null,
      );
      graphqlProjectItemRepository.addIssueToProject.mockResolvedValue(
        'new-project-item-id',
      );
      graphqlProjectItemRepository.updateProjectTextField.mockResolvedValue();

      await repository.setDependedIssueUrl(
        prUrl,
        projectWithDependedIssueUrlField,
        taskIssueUrl,
      );

      expect(
        graphqlProjectItemRepository.fetchProjectItemByUrl,
      ).toHaveBeenCalledWith(prUrl, 'test-project-id');
      expect(
        graphqlProjectItemRepository.addIssueToProject,
      ).toHaveBeenCalledWith('test-project-id', prUrl);
      expect(
        graphqlProjectItemRepository.updateProjectTextField,
      ).toHaveBeenCalledWith(
        'test-project-id',
        'depended-field-id',
        'new-project-item-id',
        taskIssueUrl,
      );
    });

    it('should set the field on the existing project item without adding the PR when it already belongs to the current project', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockResolvedValue(
        makeProjectItem('existing-project-item-id', []),
      );
      graphqlProjectItemRepository.updateProjectTextField.mockResolvedValue();

      await repository.setDependedIssueUrl(
        prUrl,
        projectWithDependedIssueUrlField,
        taskIssueUrl,
      );

      expect(
        graphqlProjectItemRepository.addIssueToProject,
      ).not.toHaveBeenCalled();
      expect(
        graphqlProjectItemRepository.updateProjectTextField,
      ).toHaveBeenCalledWith(
        'test-project-id',
        'depended-field-id',
        'existing-project-item-id',
        taskIssueUrl,
      );
    });

    it('should do nothing when the depended-issue-url field value is already set on the existing project item', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockResolvedValue(
        makeProjectItem('existing-project-item-id', [
          {
            name: 'Depended Issue URL separated by comma',
            value: taskIssueUrl,
          },
        ]),
      );

      await repository.setDependedIssueUrl(
        prUrl,
        projectWithDependedIssueUrlField,
        taskIssueUrl,
      );

      expect(
        graphqlProjectItemRepository.addIssueToProject,
      ).not.toHaveBeenCalled();
      expect(
        graphqlProjectItemRepository.updateProjectTextField,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getPullRequestChangedFilePaths', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch a single page of changed files and return their paths', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { filename: 'src/domain/Foo.ts' },
              { filename: 'src/domain/Bar.ts' },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestChangedFilePaths(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toEqual(['src/domain/Foo.ts', 'src/domain/Bar.ts']);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/files?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should paginate when a page returns exactly 100 entries and stop when fewer are returned', async () => {
      const firstPage: { filename: string }[] = [];
      for (let i = 0; i < 100; i += 1) {
        firstPage.push({ filename: `src/domain/file${i}.ts` });
      }
      const secondPage = [
        { filename: 'src/domain/extra-a.ts' },
        { filename: 'src/domain/extra-b.ts' },
      ];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(firstPage), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(secondPage), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestChangedFilePaths(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toHaveLength(102);
      expect(result[0]).toBe('src/domain/file0.ts');
      expect(result[99]).toBe('src/domain/file99.ts');
      expect(result[100]).toBe('src/domain/extra-a.ts');
      expect(result[101]).toBe('src/domain/extra-b.ts');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/files?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/files?per_page=100&page=2',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should throw when the API responds with a non-2xx status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.getPullRequestChangedFilePaths(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('approvePullRequest', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should POST an APPROVE review to the GitHub API for the PR', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, state: 'APPROVED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.approvePullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/reviews',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ event: 'APPROVE' }),
        }),
      );
    });

    it('should throw when the API responds with a non-2xx status', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Unprocessable Entity', {
          status: 422,
          statusText: 'Unprocessable Entity',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.approvePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow('422');
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
