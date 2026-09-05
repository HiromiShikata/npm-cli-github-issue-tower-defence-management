import { mock } from 'jest-mock-extended';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import type { DateRepository } from '../../../domain/usecases/adapter-interfaces/DateRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import type { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import type { LocalStorageRepository } from '../LocalStorageRepository';
import {
  ApiV3CheerioRestIssueRepository,
  RELATED_OPEN_PRS_CACHE_TTL_MS,
  REQUIRED_CHECKS_CACHE_TTL_MS,
} from './ApiV3CheerioRestIssueRepository';
import type { ApiV3IssueRepository } from './ApiV3IssueRepository';
import type {
  GraphqlProjectItemRepository,
  ProjectItem,
  ProjectItemLight,
} from './GraphqlProjectItemRepository';
import type { RestIssueRepository } from './RestIssueRepository';

const buildTestProject = (id: string): Project => ({
  id,
  url: 'https://github.com/orgs/o/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: { name: 'Status', fieldId: 'f-status', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const buildCachedIssueRecord = (url: string, title: string) => ({
  nameWithOwner: 'o/r',
  url,
  title,
  number: 1,
  state: 'OPEN',
  labels: [],
  assignees: [],
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  status: null,
  story: null,
  org: 'o',
  repo: 'r',
  body: '',
  itemId: 'item-cached',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  author: '',
  closingIssueReferenceUrls: [],
});

const buildProjectItem = (url: string, title: string): ProjectItem => ({
  id: `item-${title}`,
  nameWithOwner: 'o/r',
  number: 1,
  title,
  state: 'OPEN',
  url,
  body: null,
  labels: [],
  assignees: [],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
  author: '',
  closingIssueReferenceUrls: [],
  isRepoArchived: false,
  stateReason: null,
  customFields: [],
});

const buildLightItem = (
  id: string,
  url: string,
  updatedAt: string,
): ProjectItemLight => ({
  id,
  updatedAt,
  url,
  number: 1,
});

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
            updatedAt: '2024-01-02T00:00:00Z',
            author: 'test-author',
            closingIssueReferenceUrls: [
              'https://github.com/HiromiShikata/test-repository/issues/7',
            ],
            isRepoArchived: false,
            stateReason: 'REOPENED' as const,
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
          closingIssueReferenceUrls: [
            'https://github.com/HiromiShikata/test-repository/issues/7',
          ],
          agent: null,
          isRepoArchived: false,
          stateReason: 'REOPENED',
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
            updatedAt: '2024-01-02T00:00:00Z',
            author: '',
            closingIssueReferenceUrls: [],
            isRepoArchived: false,
            stateReason: null,
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
          closingIssueReferenceUrls: [],
          agent: null,
          isRepoArchived: false,
          stateReason: null,
        },
      },
    ];
    test.each(testCases)('%s', (arg) => {
      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = repository.convertProjectItemToIssue(...arg.params);
      expect(result).toEqual(arg.expected);
    });
  });
  describe('getAllIssues full fetch', () => {
    it('fetches the project and all items when no cache exists', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const project = buildTestProject('test-project-id');
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockResolvedValue(project);
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('test-project-id');

      expect(result.issues).toEqual([]);
      expect(result.project).toBe(project);
      expect(result.cacheUsed).toBe(false);
      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).toHaveBeenCalledWith('test-project-id');
      expect(localStorageCacheRepository.setSingle).toHaveBeenCalledTimes(1);
    });

    it('memoizes the refresh so a second call does not fetch again', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('test-project-id'),
      );
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('test-project-id');
      await repository.getAllIssues('test-project-id');

      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('get', () => {
    it('reads the single project item scoped to the given project without consulting the getAllIssues memo', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const project = buildTestProject('test-project-id');
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockResolvedValue(project);
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockResolvedValue(
        buildProjectItem('https://github.com/o/r/issues/1', 'live title'),
      );

      await repository.getAllIssues('test-project-id');
      const issue = await repository.get(
        'https://github.com/o/r/issues/1',
        project,
      );

      expect(issue?.title).toBe('live title');
      expect(
        graphqlProjectItemRepository.fetchProjectItemByUrl.mock.calls,
      ).toEqual([['https://github.com/o/r/issues/1', 'test-project-id']]);
    });

    const issueUrlOnTwoProjects = 'https://github.com/o/r/issues/1';

    const buildProjectScopedItem = (
      itemId: string,
      status: string,
      story: string,
      nextActionHour: string,
    ): ProjectItem => ({
      ...buildProjectItem(issueUrlOnTwoProjects, itemId),
      id: itemId,
      customFields: [
        { name: 'Status', value: status },
        { name: 'story', value: story },
        { name: 'nextActionHour', value: nextActionHour },
      ],
    });

    const itemOnOtherProject = buildProjectScopedItem(
      'item-on-other-project',
      'Awaiting Workspace',
      'other story',
      '9',
    );
    const itemOnRequestedProject = buildProjectScopedItem(
      'item-on-requested-project',
      'Preparation',
      'requested story',
      '17',
    );

    const arrangeItemsOnTwoProjects = (
      graphqlProjectItemRepository: ReturnType<
        typeof createApiV3CheerioRestIssueRepository
      >['graphqlProjectItemRepository'],
    ): void => {
      const itemsByProjectId = new Map<string, ProjectItem>([
        ['other-project-id', itemOnOtherProject],
        ['requested-project-id', itemOnRequestedProject],
      ]);
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockImplementation(
        async (_issueUrl: string, projectId?: string) =>
          projectId === undefined
            ? Array.from(itemsByProjectId.values())[0]
            : (itemsByProjectId.get(projectId) ?? null),
      );
    };

    it('returns the project item of the requested project when the issue is on two projects', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      arrangeItemsOnTwoProjects(graphqlProjectItemRepository);

      const issue = await repository.get(
        issueUrlOnTwoProjects,
        buildTestProject('requested-project-id'),
      );

      expect(issue?.itemId).toBe('item-on-requested-project');
      expect(issue?.status).toBe('Preparation');
      expect(issue?.story).toBe('requested story');
      expect(issue?.nextActionHour).toBe(17);
    });

    it('returns null when the issue has project items only on other projects', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      arrangeItemsOnTwoProjects(graphqlProjectItemRepository);

      const issue = await repository.get(
        issueUrlOnTwoProjects,
        buildTestProject('project-without-any-item'),
      );

      expect(issue).toBeNull();
    });
  });

  describe('getAllIssues incremental fetch', () => {
    it('light-scans the lastFetchedAt UTC day with no previous-day overlap, detail-fetches changed items by id, and upserts by url', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildTestProject('cached-project');
      const freshProject = buildTestProject('cached-project');
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [
          buildCachedIssueRecord(
            'https://github.com/o/r/issues/1',
            'stale title',
          ),
        ],
      });
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([
        buildLightItem(
          'item-fresh',
          'https://github.com/o/r/issues/1',
          '2026-07-07T00:40:00.000Z',
        ),
        buildLightItem(
          'item-new',
          'https://github.com/o/r/issues/2',
          '2026-07-07T00:44:00.000Z',
        ),
      ]);
      graphqlProjectItemRepository.fetchProjectItemsByIds.mockResolvedValue([
        buildProjectItem('https://github.com/o/r/issues/1', 'fresh title'),
        buildProjectItem('https://github.com/o/r/issues/2', 'new issue'),
      ]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(result.cacheUsed).toBe(true);
      expect(result.project).toBe(freshProject);
      expect(projectRepository.getProject).toHaveBeenCalledWith(
        'cached-project',
      );
      const lightCall =
        graphqlProjectItemRepository.fetchProjectItemsLight.mock.calls[0];
      expect(lightCall[0]).toBe('cached-project');
      expect(lightCall[1]).toBe('updated:>=2026-07-07');
      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).not.toHaveBeenCalled();
      expect(
        graphqlProjectItemRepository.fetchProjectItemsByIds,
      ).toHaveBeenCalledWith(['item-fresh', 'item-new']);
      const titlesByUrl = new Map(
        result.issues.map((issue) => [issue.url, issue.title]),
      );
      expect(titlesByUrl.get('https://github.com/o/r/issues/1')).toBe(
        'fresh title',
      );
      expect(titlesByUrl.get('https://github.com/o/r/issues/2')).toBe(
        'new issue',
      );
      expect(result.issues).toHaveLength(2);
      const cacheWrite = localStorageCacheRepository.setSingle.mock.calls[0][1];
      expect(cacheWrite).toEqual(
        expect.objectContaining({
          lastFetchedAt: '2026-07-07T00:45:00.000Z',
          lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        }),
      );
    });

    it('includes items within the clock-skew buffer before lastFetchedAt and excludes items older than the buffer', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: buildTestProject('cached-project'),
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('cached-project'),
      );
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([
        buildLightItem(
          'wellBefore',
          'https://github.com/o/r/issues/1',
          '2026-07-07T00:20:00.000Z',
        ),
        buildLightItem(
          'withinBuffer',
          'https://github.com/o/r/issues/2',
          '2026-07-07T00:27:00.000Z',
        ),
        buildLightItem(
          'atLastFetched',
          'https://github.com/o/r/issues/3',
          '2026-07-07T00:30:00.000Z',
        ),
        buildLightItem(
          'after',
          'https://github.com/o/r/issues/4',
          '2026-07-07T00:40:00.000Z',
        ),
      ]);
      graphqlProjectItemRepository.fetchProjectItemsByIds.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('cached-project');

      expect(
        graphqlProjectItemRepository.fetchProjectItemsByIds,
      ).toHaveBeenCalledWith(['withinBuffer', 'atLastFetched', 'after']);
    });

    it('applies the skew buffer across a UTC-midnight boundary, scanning the previous UTC day rather than today', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:30:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:02:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: buildTestProject('cached-project'),
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('cached-project'),
      );
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([
        buildLightItem(
          'previousDay',
          'https://github.com/o/r/issues/1',
          '2026-07-06T23:58:00.000Z',
        ),
        buildLightItem(
          'beforeBuffer',
          'https://github.com/o/r/issues/2',
          '2026-07-06T23:55:00.000Z',
        ),
      ]);
      graphqlProjectItemRepository.fetchProjectItemsByIds.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('cached-project');

      const lightCall =
        graphqlProjectItemRepository.fetchProjectItemsLight.mock.calls[0];
      expect(lightCall[1]).toBe('updated:>=2026-07-06');
      expect(
        graphqlProjectItemRepository.fetchProjectItemsByIds,
      ).toHaveBeenCalledWith(['previousDay']);
    });

    it('skips the detail fetch entirely when no light item changed since lastFetchedAt', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: buildTestProject('cached-project'),
        issues: [
          buildCachedIssueRecord(
            'https://github.com/o/r/issues/1',
            'unchanged title',
          ),
        ],
      });
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('cached-project'),
      );
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([
        buildLightItem(
          'stale',
          'https://github.com/o/r/issues/1',
          '2026-07-07T00:10:00.000Z',
        ),
      ]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(
        graphqlProjectItemRepository.fetchProjectItemsByIds,
      ).not.toHaveBeenCalled();
      expect(result.cacheUsed).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].title).toBe('unchanged title');
      const cacheWrite = localStorageCacheRepository.setSingle.mock.calls[0][1];
      expect(cacheWrite).toEqual(
        expect.objectContaining({
          lastFetchedAt: '2026-07-07T00:45:00.000Z',
          lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        }),
      );
    });

    it('performs a full fetch when the hourly gate has elapsed', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T02:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:50:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: buildTestProject('cached-project'),
        issues: [],
      });
      const freshProject = buildTestProject('fresh-project');
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(result.cacheUsed).toBe(false);
      expect(result.project).toBe(freshProject);
      expect(projectRepository.getProject).toHaveBeenCalledWith(
        'cached-project',
      );
    });
  });

  describe('getAllIssues story option rename detection', () => {
    const buildStoryOption = (
      id: string,
      name: string,
    ): {
      id: string;
      name: string;
      color: 'GRAY';
      description: string;
    } => ({ id, name, color: 'GRAY', description: '' });

    const buildProjectWithStories = (
      id: string,
      stories: { id: string; name: string }[],
    ): Project => ({
      ...buildTestProject(id),
      story: {
        name: 'Story',
        fieldId: 'story-field-id',
        databaseId: 1,
        stories: stories.map((s) => buildStoryOption(s.id, s.name)),
        workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
      },
    });

    it('calls projectRepository.getProject on every incremental fetch cycle', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildTestProject('cached-project');
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(cachedProject);
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('cached-project');

      expect(projectRepository.getProject).toHaveBeenCalledWith(
        'cached-project',
      );
    });

    it('escalates to full fetch when a story option name changes between cache and fresh project', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Old Story Name' },
      ]);
      const freshProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'New Story Name' },
      ]);
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).toHaveBeenCalledWith('cached-project');
      expect(
        graphqlProjectItemRepository.fetchProjectItemsLight,
      ).not.toHaveBeenCalled();
      expect(result.cacheUsed).toBe(false);
    });

    it('escalates to full fetch when a story option is removed in the fresh project', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
        { id: 'opt-2', name: 'Story B' },
      ]);
      const freshProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
      ]);
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).toHaveBeenCalledWith('cached-project');
      expect(result.cacheUsed).toBe(false);
    });

    it('proceeds with incremental fetch when story options are unchanged', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
      ]);
      const freshProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
      ]);
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(
        graphqlProjectItemRepository.fetchProjectItems,
      ).not.toHaveBeenCalled();
      expect(result.cacheUsed).toBe(true);
    });

    it('writes the fresh project (not cache.project) to cache during incremental fetch', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
      ]);
      const freshProject = buildProjectWithStories('cached-project', [
        { id: 'opt-1', name: 'Story A' },
        { id: 'opt-2', name: 'Story B (new)' },
      ]);
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(freshProject);
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('cached-project');

      const cacheWrite = localStorageCacheRepository.setSingle.mock.calls[0][1];
      expect(cacheWrite).toEqual(
        expect.objectContaining({ project: freshProject }),
      );
    });

    it('falls back to cache.project and logs a warning when getProject fails during incremental fetch', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      const cachedProject = buildTestProject('cached-project');
      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });
      projectRepository.getProject.mockRejectedValue(
        new Error('network error'),
      );
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      const result = await repository.getAllIssues('cached-project');

      expect(result.cacheUsed).toBe(true);
      expect(result.project).toBe(cachedProject);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to refresh project metadata'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cached-project'),
      );
      warnSpy.mockRestore();
    });

    it('re-throws the error when getProject fails during a full fetch with no cache', async () => {
      const {
        repository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockRejectedValue(
        new Error('project fetch failed'),
      );

      await expect(repository.getAllIssues('cached-project')).rejects.toThrow(
        'project fetch failed',
      );
    });
  });

  describe('getLastIssuesFetchedAt', () => {
    it('reports null before any fetch has happened for the project', () => {
      const { repository } = createApiV3CheerioRestIssueRepository();

      expect(repository.getLastIssuesFetchedAt('test-project-id')).toBeNull();
    });

    it('reports the full-fetch read time rather than a later moment', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('test-project-id'),
      );
      graphqlProjectItemRepository.fetchProjectItems.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('test-project-id');

      expect(repository.getLastIssuesFetchedAt('test-project-id')).toBe(
        '2026-07-07T00:00:00.000Z',
      );
    });

    it('reports the incremental-fetch read time and keeps projects independent', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:45:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: buildTestProject('cached-project'),
        issues: [],
      });
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('cached-project'),
      );
      graphqlProjectItemRepository.fetchProjectItemsLight.mockResolvedValue([]);
      localStorageCacheRepository.setSingle.mockResolvedValue();

      await repository.getAllIssues('cached-project');

      expect(repository.getLastIssuesFetchedAt('cached-project')).toBe(
        '2026-07-07T00:45:00.000Z',
      );
      expect(repository.getLastIssuesFetchedAt('other-project')).toBeNull();
    });
  });

  describe('getAllIssues throws when fetchProjectItems throws', () => {
    it('should not write cache and should propagate error when fetchProjectItems throws', async () => {
      const {
        repository,
        graphqlProjectItemRepository,
        localStorageCacheRepository,
        projectRepository,
        dateRepository,
      } = createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(new Date('2026-07-07T00:00:00Z'));
      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      projectRepository.getProject.mockResolvedValue(
        buildTestProject('test-project-id'),
      );
      const fetchError = new Error(
        'fetchProjectItems: expected 5 items but accumulated 1',
      );
      graphqlProjectItemRepository.fetchProjectItems.mockRejectedValue(
        fetchError,
      );

      await expect(repository.getAllIssues('test-project-id')).rejects.toThrow(
        fetchError,
      );
      expect(localStorageCacheRepository.setSingle).not.toHaveBeenCalled();
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
        agent: null,
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
        closingIssueReferenceUrls: [],
        agent: null,
        stateReason: null,
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

  describe('getCachedProject', () => {
    it('returns the daemon-cached project without any GraphQL project load', async () => {
      const { repository, localStorageCacheRepository, projectRepository } =
        createApiV3CheerioRestIssueRepository();
      const cachedProject = buildTestProject('cached-project');
      localStorageCacheRepository.getSingle.mockResolvedValue({
        lastFetchedAt: '2026-07-07T00:30:00.000Z',
        lastFullFetchAt: '2026-07-07T00:00:00.000Z',
        project: cachedProject,
        issues: [],
      });

      const result = await repository.getCachedProject('cached-project');

      expect(result).toEqual(cachedProject);
      expect(localStorageCacheRepository.getSingle).toHaveBeenCalledWith(
        'allIssues-cached-project',
      );
      expect(projectRepository.getProject).not.toHaveBeenCalled();
    });

    it('returns null on a cache miss so the caller can fall back to GraphQL', async () => {
      const { repository, localStorageCacheRepository, projectRepository } =
        createApiV3CheerioRestIssueRepository();
      localStorageCacheRepository.getSingle.mockResolvedValue(null);

      const result = await repository.getCachedProject('missing-project');

      expect(result).toBeNull();
      expect(projectRepository.getProject).not.toHaveBeenCalled();
    });

    it('returns null when cached project data does not match the expected Project shape', async () => {
      const { repository, localStorageCacheRepository } =
        createApiV3CheerioRestIssueRepository();
      localStorageCacheRepository.getSingle.mockResolvedValue({
        project: { invalid: 'data' },
      });

      const result = await repository.getCachedProject('some-project');

      expect(result).toBeNull();
    });
  });

  describe('updateNextActionDate', () => {
    const projectWithNextActionDate = (): Project => ({
      ...buildTestProject('nad-project'),
      nextActionDate: { name: 'Next Action Date', fieldId: 'nad-field' },
    });

    it('uses the provided project item id and skips the GraphQL item fetch', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.updateProjectField.mockResolvedValue();

      await repository.updateNextActionDate(
        'https://github.com/o/r/issues/1',
        projectWithNextActionDate(),
        new Date('2026-07-20T00:00:00.000Z'),
        'given-item-id',
      );

      expect(
        graphqlProjectItemRepository.fetchProjectItemByUrl,
      ).not.toHaveBeenCalled();
      expect(
        graphqlProjectItemRepository.updateProjectField,
      ).toHaveBeenCalledWith('nad-project', 'nad-field', 'given-item-id', {
        date: '2026-07-20',
      });
    });

    it('falls back to fetchProjectItemByUrl when no project item id is provided', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.updateProjectField.mockResolvedValue();
      graphqlProjectItemRepository.fetchProjectItemByUrl.mockResolvedValue(
        buildProjectItem('https://github.com/o/r/issues/1', 'fallback'),
      );

      await repository.updateNextActionDate(
        'https://github.com/o/r/issues/1',
        projectWithNextActionDate(),
        new Date('2026-07-20T00:00:00.000Z'),
      );

      expect(
        graphqlProjectItemRepository.fetchProjectItemByUrl,
      ).toHaveBeenCalledWith('https://github.com/o/r/issues/1', 'nad-project');
      expect(
        graphqlProjectItemRepository.updateProjectField,
      ).toHaveBeenCalledWith('nad-project', 'nad-field', 'item-fallback', {
        date: '2026-07-20',
      });
    });
  });

  describe('updateNextActionHour', () => {
    const buildProjectWithHourOptions = (
      optionEntries: { id: string; name: string }[],
    ): Project & {
      nextActionHour: NonNullable<Project['nextActionHour']>;
    } => ({
      ...buildTestProject('hour-project'),
      nextActionHour: {
        name: 'Next Action Hour',
        fieldId: 'nah-field',
        options: optionEntries.map((o) => ({
          ...o,
          color: 'GRAY' as const,
          description: '',
        })),
      },
    });

    const testIssue = {
      ...mock<Issue>(),
      itemId: 'test-item-id',
    };

    it('submits singleSelectOptionId when a matching option exists', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.updateProjectField.mockResolvedValue();
      const project = buildProjectWithHourOptions([{ id: 'opt9', name: '9' }]);

      await repository.updateNextActionHour(project, testIssue, 9);

      expect(
        graphqlProjectItemRepository.updateProjectField,
      ).toHaveBeenCalledWith('hour-project', 'nah-field', 'test-item-id', {
        singleSelectOptionId: 'opt9',
      });
    });

    it('falls back to number when no matching option exists', async () => {
      const { repository, graphqlProjectItemRepository } =
        createApiV3CheerioRestIssueRepository();
      graphqlProjectItemRepository.updateProjectField.mockResolvedValue();
      const project = buildProjectWithHourOptions([]);

      await repository.updateNextActionHour(project, testIssue, 9);

      expect(
        graphqlProjectItemRepository.updateProjectField,
      ).toHaveBeenCalledWith('hour-project', 'nah-field', 'test-item-id', {
        number: 9,
      });
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

    it("should surface GitHub's reason together with the status when the API rejects the approval", async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Review Can not approve your own pull request',
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.approvePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow(
        'Failed to approve PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 422 Review Can not approve your own pull request',
      );
    });
  });

  describe('closePullRequest', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should surface GitHub's reason together with the status when the close fails", async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.closePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow(
        'Failed to close PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 404 Not Found',
      );
    });

    it('should fall back to the status alone when the error body is not JSON', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.closePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow(
        'Failed to close PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 500',
      );
    });
  });

  describe('mergePullRequest', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should PUT to the GitHub merge API with no merge_method when the repository allows merge commits', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.mergePullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/merge',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({}),
        }),
      );
    });

    it('should fall back to squash merge when the repository disallows merge commits (HTTP 405)', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'Merge commits are not allowed on this repository.',
            }),
            { status: 405, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              allow_squash_merge: true,
              allow_rebase_merge: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.mergePullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        3,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/merge',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ merge_method: 'squash' }),
        }),
      );
    });

    it('should fall back to rebase merge when squash merge is also disallowed', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'Merge commits are not allowed on this repository.',
            }),
            { status: 405, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              allow_squash_merge: false,
              allow_rebase_merge: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.mergePullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        3,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/merge',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ merge_method: 'rebase' }),
        }),
      );
    });

    it('should throw with the original error when no alternative merge method is available after HTTP 405', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'Merge commits are not allowed on this repository.',
            }),
            { status: 405, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              allow_squash_merge: false,
              allow_rebase_merge: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.mergePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow(
        'Failed to merge PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 405 Merge commits are not allowed on this repository.',
      );
    });

    it('should throw when the merge API responds with a non-405 error', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.mergePullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow(
        'Failed to merge PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 404 Not Found',
      );
    });
  });

  describe('rate-limit-aware retry on console operations', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('retries a transient 403 rate-limit response and resolves the operation after a success', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ state: 'closed' }), { status: 200 }),
        );

      const { repository, sleep } = createApiV3CheerioRestIssueRepository();
      await repository.closeIssueByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/42',
        'completed',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('retries a transient 429 secondary-rate-limit response and resolves the operation after a success', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'You have exceeded a secondary rate limit',
            }),
            { status: 429, headers: { 'retry-after': '1' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              state: 'open',
              merged: false,
              title: 'Issue title',
            }),
            {
              status: 200,
            },
          ),
        );

      const { repository, sleep } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestState(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result.state).toBe('open');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('does not retry a genuine permission 403 and surfaces a clear permission message', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Resource not accessible by integration',
          }),
          { status: 403, headers: { 'x-ratelimit-remaining': '4999' } },
        ),
      );

      const { repository, sleep } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.closeIssueByUrl(
          'https://github.com/HiromiShikata/test-repository/issues/42',
          'completed',
        ),
      ).rejects.toThrow(
        'Failed to close issue https://github.com/HiromiShikata/test-repository/issues/42: HTTP 403 permission denied, the token cannot perform this operation Resource not accessible by integration',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('surfaces a clear rate-limit message including the reset time after the bounded retries are exhausted', async () => {
      const resetEpochSeconds = 1700000000;
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(resetEpochSeconds),
          },
        }),
      );

      const { repository, sleep } = createApiV3CheerioRestIssueRepository();
      const expectedResetIso = new Date(resetEpochSeconds * 1000).toISOString();
      await expect(
        repository.closeIssueByUrl(
          'https://github.com/HiromiShikata/test-repository/issues/42',
          'completed',
        ),
      ).rejects.toThrow(
        `Failed to close issue https://github.com/HiromiShikata/test-repository/issues/42: HTTP 403 GitHub rate limit exceeded, please retry shortly (resets at ${expectedResetIso})`,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(sleep).toHaveBeenCalledTimes(3);
    });
  });

  describe('createCommentByUrl', () => {
    it('returns the created comment data from the repository', async () => {
      const { repository, restIssueRepository } =
        createApiV3CheerioRestIssueRepository();
      const commentData = {
        author: 'HiromiShikata',
        body: 'test comment',
        createdAt: new Date('2026-08-30T09:00:00Z'),
        url: 'https://github.com/HiromiShikata/test-repository/issues/40#issuecomment-999',
      };
      restIssueRepository.createComment.mockResolvedValue(commentData);

      const result = await repository.createCommentByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );

      expect(restIssueRepository.createComment).toHaveBeenCalledWith(
        'https://github.com/HiromiShikata/test-repository/issues/40',
        'test comment',
      );
      expect(result).toEqual(commentData);
    });
  });

  describe('requestChangesWithInlineComment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('submits a REQUEST_CHANGES review with a non-empty body and a line-anchored comment', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.requestChangesWithInlineComment(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'src/index.ts',
        'Please address this.',
        { line: 17, side: 'RIGHT' },
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/reviews',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            event: 'REQUEST_CHANGES',
            body: 'Please address this.',
            comments: [
              {
                path: 'src/index.ts',
                line: 17,
                side: 'RIGHT',
                body: 'Please address this.',
              },
            ],
          }),
        }),
      );
    });

    it('falls back to a positional comment but still sends a non-empty body when no line anchor is provided', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 8 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.requestChangesWithInlineComment(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'src/index.ts',
        'Please address this.',
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/reviews',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            event: 'REQUEST_CHANGES',
            body: 'Please address this.',
            comments: [
              {
                path: 'src/index.ts',
                position: 1,
                body: 'Please address this.',
              },
            ],
          }),
        }),
      );
    });

    it('records the requested changes as a review comment when GitHub refuses a review by the pull request author', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'Unprocessable Entity',
              errors: [
                {
                  message:
                    'Review Can not request changes on your own pull request',
                },
              ],
            }),
            {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ head: { sha: 'head-sha' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 11 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.requestChangesWithInlineComment(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'src/index.ts',
        'Please address this.',
        { line: 17, side: 'RIGHT' },
      );

      expect(fetchSpy).toHaveBeenLastCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            body: 'Please address this.',
            commit_id: 'head-sha',
            path: 'src/index.ts',
            line: 17,
            side: 'RIGHT',
          }),
        }),
      );
    });

    it('records the requested changes as a pull request comment when GitHub refuses the review and no line anchor was entered', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Unprocessable Entity',
            errors: [
              {
                message:
                  'Review Can not request changes on your own pull request',
              },
            ],
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { repository, restIssueRepository } =
        createApiV3CheerioRestIssueRepository();
      await repository.requestChangesWithInlineComment(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'src/index.ts',
        'Please address this.',
      );

      expect(restIssueRepository.createComment).toHaveBeenCalledWith(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'Please address this.',
      );
    });

    it("should surface GitHub's validation reason together with the status when the review POST fails", async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Validation Failed',
            errors: [{ message: 'path must be part of the diff' }],
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.requestChangesWithInlineComment(
          'https://github.com/HiromiShikata/test-repository/pull/42',
          'src/index.ts',
          'Please address this.',
        ),
      ).rejects.toThrow(
        'Failed to request changes on PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 422 Validation Failed: path must be part of the diff',
      );
    });

    it('should surface string entries in the GitHub errors array', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Validation Failed',
            errors: ['position is required'],
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.requestChangesWithInlineComment(
          'https://github.com/HiromiShikata/test-repository/pull/42',
          'src/index.ts',
          'Please address this.',
        ),
      ).rejects.toThrow(
        'Failed to request changes on PR https://github.com/HiromiShikata/test-repository/pull/42: HTTP 422 Validation Failed: position is required',
      );
    });
  });

  describe('createPullRequestReviewComment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch the head commit and POST a line-anchored review comment', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ head: { sha: 'abc123' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 5 }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.createPullRequestReviewComment(
        'https://github.com/HiromiShikata/test-repository/pull/42',
        'src/index.ts',
        17,
        'RIGHT',
        'Please rename this variable.',
      );

      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/comments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            body: 'Please rename this variable.',
            commit_id: 'abc123',
            path: 'src/index.ts',
            line: 17,
            side: 'RIGHT',
          }),
        }),
      );
    });

    it('should surface the GitHub error message when the comment POST fails', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ head: { sha: 'abc123' } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: 'Validation Failed',
              errors: [{ message: 'line must be part of the diff' }],
            }),
            {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.createPullRequestReviewComment(
          'https://github.com/HiromiShikata/test-repository/pull/42',
          'src/index.ts',
          17,
          'RIGHT',
          'Please rename this variable.',
        ),
      ).rejects.toThrow(
        'HTTP 422 Validation Failed: line must be part of the diff',
      );
    });

    it('should throw when the head commit cannot be fetched', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.createPullRequestReviewComment(
          'https://github.com/HiromiShikata/test-repository/pull/42',
          'src/index.ts',
          17,
          'RIGHT',
          'Please rename this variable.',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('getIssueOrPullRequestBody', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch and return the issue body', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ body: 'issue body content' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestBody(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toBe('issue body content');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should map a null body to an empty string', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ body: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestBody(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toBe('');
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
        repository.getIssueOrPullRequestBody(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('getIssueBodyByUrl', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reads the body over the REST issue endpoint', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ body: 'story issue body' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueBodyByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toBe('story issue body');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns null when the issue no longer exists', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueBodyByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toBeNull();
    });

    it('throws when the API fails for a reason other than the issue being absent', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response('Bad Gateway', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.getIssueBodyByUrl(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('502');
    });
  });

  describe('getIssueOrPullRequestComments', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch a single page of comments ordered oldest-first', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              user: { login: 'alice' },
              body: 'first comment',
              created_at: '2024-01-01T00:00:00Z',
              html_url:
                'https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-1',
            },
            {
              user: { login: 'bob' },
              body: 'second comment',
              created_at: '2024-01-02T00:00:00Z',
              html_url:
                'https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-2',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestComments(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toEqual([
        {
          author: 'alice',
          body: 'first comment',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          url: 'https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-1',
        },
        {
          author: 'bob',
          body: 'second comment',
          createdAt: new Date('2024-01-02T00:00:00Z'),
          url: 'https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-2',
        },
      ]);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42/comments?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should paginate when a page returns exactly 100 entries', async () => {
      const firstPage: {
        user: { login: string };
        body: string;
        created_at: string;
        html_url: string;
      }[] = [];
      for (let i = 0; i < 100; i += 1) {
        firstPage.push({
          user: { login: `user${i}` },
          body: `comment ${i}`,
          created_at: '2024-01-01T00:00:00Z',
          html_url: `https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-${i}`,
        });
      }
      const secondPage = [
        {
          user: { login: 'last' },
          body: 'last comment',
          created_at: '2024-02-01T00:00:00Z',
          html_url:
            'https://github.com/HiromiShikata/test-repository/issues/42#issuecomment-100',
        },
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
      const result = await repository.getIssueOrPullRequestComments(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toHaveLength(101);
      expect(result[100].author).toBe('last');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42/comments?per_page=100&page=2',
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
        repository.getIssueOrPullRequestComments(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('deleteAllCommentsByUrl', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches comment ids and deletes each comment', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: 101,
                user: { login: 'alice' },
                body: 'a',
                created_at: '2024-01-01T00:00:00Z',
              },
              {
                id: 102,
                user: { login: 'bob' },
                body: 'b',
                created_at: '2024-01-02T00:00:00Z',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.deleteAllCommentsByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42/comments?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/comments/101',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        3,
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/comments/102',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('paginates when a page returns exactly 100 comments', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        user: { login: 'user' },
        body: 'text',
        created_at: '2024-01-01T00:00:00Z',
      }));
      const secondPage = [
        {
          id: 200,
          user: { login: 'user' },
          body: 'last',
          created_at: '2024-02-01T00:00:00Z',
        },
      ];
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      for (let i = 0; i < 100; i += 1) {
        fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
      }
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(secondPage), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.deleteAllCommentsByUrl(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      const getCalls = fetchSpy.mock.calls.filter(
        ([, opts]) => opts?.method === 'GET',
      );
      expect(getCalls).toHaveLength(2);
      expect(getCalls[0]?.[0]).toContain('page=1');
      expect(getCalls[1]?.[0]).toContain('page=1');
      const deleteCallCount = fetchSpy.mock.calls.filter(
        ([, opts]) => opts?.method === 'DELETE',
      ).length;
      expect(deleteCallCount).toBe(101);
    });

    it('throws when the API responds with a non-2xx status on the GET', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.deleteAllCommentsByUrl(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('403');
    });

    it('throws when a DELETE request fails', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: 99,
                user: null,
                body: 'x',
                created_at: '2024-01-01T00:00:00Z',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response('Unauthorized', {
            status: 401,
            statusText: 'Unauthorized',
          }),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.deleteAllCommentsByUrl(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('401');
    });
  });

  describe('getPullRequestDetail', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const detailResponse = {
      title: 'PR title',
      state: 'open',
      merged: false,
      draft: true,
      additions: 10,
      deletions: 3,
      changed_files: 2,
      head: { ref: 'feature/foo' },
      base: { ref: 'main' },
      user: { login: 'alice' },
      body: 'pr body',
    };

    it('should fetch detail and paginated files for a pull request', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(detailResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                filename: 'src/Foo.ts',
                status: 'modified',
                additions: 7,
                deletions: 2,
                patch: '@@ -1 +1 @@',
                raw_url:
                  'https://github.com/HiromiShikata/test-repository/raw/abcdef1/src/Foo.ts',
              },
              {
                filename: 'src/Bar.ts',
                status: 'added',
                additions: 3,
                deletions: 1,
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestDetail(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toEqual({
        title: 'PR title',
        state: 'open',
        merged: false,
        isDraft: true,
        additions: 10,
        deletions: 3,
        changedFiles: 2,
        headRefName: 'feature/foo',
        baseRefName: 'main',
        author: 'alice',
        files: [
          {
            filename: 'src/Foo.ts',
            status: 'modified',
            additions: 7,
            deletions: 2,
            patch: '@@ -1 +1 @@',
            rawUrl:
              'https://raw.githubusercontent.com/HiromiShikata/test-repository/abcdef1/src/Foo.ts',
          },
          {
            filename: 'src/Bar.ts',
            status: 'added',
            additions: 3,
            deletions: 1,
            patch: null,
            rawUrl: null,
          },
        ],
      });
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/files?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should paginate the files list across two pages', async () => {
      const firstPage: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
      }[] = [];
      for (let i = 0; i < 100; i += 1) {
        firstPage.push({
          filename: `src/file${i}.ts`,
          status: 'modified',
          additions: 1,
          deletions: 0,
        });
      }
      const secondPage = [
        {
          filename: 'src/extra.ts',
          status: 'added',
          additions: 2,
          deletions: 0,
        },
      ];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(detailResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
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
      const result = await repository.getPullRequestDetail(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result?.files).toHaveLength(101);
      expect(result?.files[100].filename).toBe('src/extra.ts');
      expect(fetchSpy).toHaveBeenNthCalledWith(
        3,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/files?per_page=100&page=2',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return null when the URL is not a pull request', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestDetail(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
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
        repository.getPullRequestDetail(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('getPullRequestCommits', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch a single page of commits', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              sha: 'abc123',
              commit: {
                message: 'first commit',
                author: { name: 'Alice', date: '2024-01-01T00:00:00Z' },
              },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestCommits(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toEqual([
        {
          sha: 'abc123',
          message: 'first commit',
          author: 'Alice',
          authoredAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/commits?per_page=100&page=1',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should paginate when a page returns exactly 100 entries', async () => {
      const firstPage: {
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
      }[] = [];
      for (let i = 0; i < 100; i += 1) {
        firstPage.push({
          sha: `sha${i}`,
          commit: {
            message: `commit ${i}`,
            author: { name: 'Alice', date: '2024-01-01T00:00:00Z' },
          },
        });
      }
      const secondPage = [
        {
          sha: 'last-sha',
          commit: {
            message: 'last commit',
            author: { name: 'Bob', date: '2024-02-01T00:00:00Z' },
          },
        },
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
      const result = await repository.getPullRequestCommits(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toHaveLength(101);
      expect(result[100].sha).toBe('last-sha');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42/commits?per_page=100&page=2',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return an empty list when the URL is not a pull request', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestCommits(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
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
        repository.getPullRequestCommits(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('getIssueOrPullRequestState', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch pull-request state and merged flag for a PR URL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'PR title',
            state: 'closed',
            merged: true,
            draft: false,
            additions: 1,
            deletions: 1,
            changed_files: 1,
            head: { ref: 'feature/foo' },
            base: { ref: 'main' },
            user: { login: 'alice' },
            body: 'pr body',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestState(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toEqual({
        state: 'closed',
        merged: true,
        isPullRequest: true,
        title: 'PR title',
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should fetch issue state with merged always false for an issue URL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'open', title: 'Issue title' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestState(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toEqual({
        state: 'open',
        merged: false,
        isPullRequest: false,
        title: 'Issue title',
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/issues/42',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return the issue title carried by the same REST payload', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ state: 'closed', title: 'Issue title from REST' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestState(
        'https://github.com/HiromiShikata/other-repository/issues/656',
      );

      expect(result).toEqual({
        state: 'closed',
        merged: false,
        isPullRequest: false,
        title: 'Issue title from REST',
      });
    });

    it('should return the pull request title carried by the same REST payload', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'PR title from REST',
            state: 'open',
            merged: false,
            draft: false,
            additions: 1,
            deletions: 1,
            changed_files: 1,
            head: { ref: 'feature/foo' },
            base: { ref: 'main' },
            user: { login: 'alice' },
            body: 'pr body',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getIssueOrPullRequestState(
        'https://github.com/HiromiShikata/other-repository/pull/42',
      );

      expect(result).toEqual({
        state: 'open',
        merged: false,
        isPullRequest: true,
        title: 'PR title from REST',
      });
    });

    it('should throw rather than report an empty title when the payload carries no title', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ state: 'open' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();

      await expect(
        repository.getIssueOrPullRequestState(
          'https://github.com/HiromiShikata/other-repository/issues/656',
        ),
      ).rejects.toThrow('Unexpected response shape when fetching state for');
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
        repository.getIssueOrPullRequestState(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  describe('getPullRequestSummary', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch the title, body, and changed-line counts for a PR', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: 'PR title',
            state: 'open',
            merged: false,
            draft: false,
            additions: 12,
            deletions: 4,
            changed_files: 3,
            head: { ref: 'feature/foo' },
            base: { ref: 'main' },
            user: { login: 'alice' },
            body: 'pr body',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestSummary(
        'https://github.com/HiromiShikata/test-repository/pull/42',
      );

      expect(result).toEqual({
        title: 'PR title',
        body: 'pr body',
        additions: 12,
        deletions: 4,
        changedFiles: 3,
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return null when the URL is not a pull request', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getPullRequestSummary(
        'https://github.com/HiromiShikata/test-repository/issues/42',
      );

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
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
        repository.getPullRequestSummary(
          'https://github.com/HiromiShikata/test-repository/pull/42',
        ),
      ).rejects.toThrow('404');
    });
  });

  const jsonResponse = (body: object): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const toResponse = (value: Response | object): Response =>
    value instanceof Response ? value : jsonResponse(value);

  type FetchRoutes = {
    timeline?: () => Response | object;
    mergeability?: () => Response | object;
    slimPullRequest?: (variables: {
      owner?: string;
      repo?: string;
      prNumber: number;
      reviewThreadsAfter: string | null;
    }) => Response | object;
    slimPullRequestBatch?: (
      variables: Record<string, unknown>,
    ) => Response | object;
    branchRules?: (url: string) => Response | object;
    branchDetail?: (url: string) => Response | object;
    checkRuns?: (url: string) => Response | object;
    checkSuites?: (url: string) => Response | object;
    combinedStatus?: (url: string) => Response | object;
  };

  const requestUrlOf = (input: RequestInfo | URL): string =>
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const requestBodyOf = (init?: RequestInit): string =>
    typeof init?.body === 'string' ? init.body : '';

  type GraphqlRequestBody = {
    query: string;
    variables: {
      owner?: string;
      repo?: string;
      prNumber: number;
      reviewThreadsAfter: string | null;
    };
    rawVariables: Record<string, unknown>;
  };

  const parseGraphqlRequestBody = (init?: RequestInit): GraphqlRequestBody => {
    const parsed: unknown = JSON.parse(requestBodyOf(init));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('query' in parsed) ||
      typeof parsed.query !== 'string'
    ) {
      throw new Error('Unexpected GraphQL request body in test');
    }
    const rawVariables: unknown =
      'variables' in parsed ? parsed.variables : null;
    const variables =
      typeof rawVariables === 'object' && rawVariables !== null
        ? rawVariables
        : {};
    const owner =
      'owner' in variables && typeof variables.owner === 'string'
        ? variables.owner
        : undefined;
    const repo =
      'repo' in variables && typeof variables.repo === 'string'
        ? variables.repo
        : undefined;
    const prNumber =
      'prNumber' in variables && typeof variables.prNumber === 'number'
        ? variables.prNumber
        : 0;
    const reviewThreadsAfter =
      'reviewThreadsAfter' in variables &&
      typeof variables.reviewThreadsAfter === 'string'
        ? variables.reviewThreadsAfter
        : null;
    return {
      query: parsed.query,
      variables: { owner, repo, prNumber, reviewThreadsAfter },
      rawVariables: Object.fromEntries(Object.entries(variables)),
    };
  };

  const mockFetchRoutes = (routes: FetchRoutes) =>
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = requestUrlOf(input);
          if (url === 'https://api.github.com/graphql') {
            const body = parseGraphqlRequestBody(init);
            if (body.query.includes('timelineItems') && routes.timeline) {
              return toResponse(routes.timeline());
            }
            if (
              body.query.includes('mergeStateStatus') &&
              routes.mergeability
            ) {
              return toResponse(routes.mergeability());
            }
            if (
              body.query.includes('PullRequestSlimStatusBatch') &&
              routes.slimPullRequestBatch
            ) {
              return toResponse(routes.slimPullRequestBatch(body.rawVariables));
            }
            if (body.query.includes('headRefOid') && routes.slimPullRequest) {
              return toResponse(routes.slimPullRequest(body.variables));
            }
            throw new Error(`Unexpected GraphQL query in test: ${body.query}`);
          }
          if (url.includes('/rules/branches/')) {
            return toResponse(
              routes.branchRules ? routes.branchRules(url) : [],
            );
          }
          if (/\/branches\/[^/?]+$/.test(url)) {
            return toResponse(
              routes.branchDetail ? routes.branchDetail(url) : {},
            );
          }
          if (url.includes('/check-suites') && !url.includes('/check-runs')) {
            return toResponse(
              routes.checkSuites
                ? routes.checkSuites(url)
                : { total_count: 0, check_suites: [] },
            );
          }
          if (url.includes('/check-runs')) {
            return toResponse(
              routes.checkRuns
                ? routes.checkRuns(url)
                : { total_count: 0, check_runs: [] },
            );
          }
          if (url.includes('/status?')) {
            return toResponse(
              routes.combinedStatus
                ? routes.combinedStatus(url)
                : { statuses: [] },
            );
          }
          throw new Error(`Unexpected fetch URL in test: ${url}`);
        },
      );

  type FetchSpy = ReturnType<typeof mockFetchRoutes>;

  const countCallsMatching = (
    fetchSpy: FetchSpy,
    predicate: (url: string, body: string) => boolean,
  ): number =>
    fetchSpy.mock.calls.filter(([input, init]: Parameters<typeof fetch>) =>
      predicate(requestUrlOf(input), requestBodyOf(init)),
    ).length;

  const countMergeabilityQueries = (fetchSpy: FetchSpy): number =>
    countCallsMatching(
      fetchSpy,
      (url, body) =>
        url === 'https://api.github.com/graphql' &&
        body.includes('mergeStateStatus'),
    );

  const countSlimPullRequestBatchQueries = (fetchSpy: FetchSpy): number =>
    countCallsMatching(
      fetchSpy,
      (url, body) =>
        url === 'https://api.github.com/graphql' &&
        body.includes('PullRequestSlimStatusBatch'),
    );

  const buildSlimPullRequestResponse = (
    overrides: {
      url?: string;
      state?: string;
      isDraft?: boolean;
      headRefName?: string;
      baseRefName?: string;
      mergeable?: string;
      headRefOid?: string;
      reviewThreads?: {
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        nodes: Array<{ isResolved: boolean }>;
      };
    } = {},
  ) => ({
    data: {
      repository: {
        pullRequest: {
          url:
            overrides.url ??
            'https://github.com/HiromiShikata/test-repository/pull/31',
          state: overrides.state ?? 'OPEN',
          isDraft: overrides.isDraft ?? false,
          headRefName: overrides.headRefName ?? 'feature-branch',
          baseRefName: overrides.baseRefName ?? 'main',
          mergeable: overrides.mergeable ?? 'MERGEABLE',
          headRefOid: overrides.headRefOid ?? 'headsha123',
          reviewThreads: overrides.reviewThreads ?? {
            pageInfo: { endCursor: null, hasNextPage: false },
            nodes: [],
          },
        },
      },
    },
  });

  const buildSlimPullRequestNode = (
    overrides: Parameters<typeof buildSlimPullRequestResponse>[0] = {},
  ) => buildSlimPullRequestResponse(overrides).data.repository.pullRequest;

  describe('getOpenPullRequests batched resolution', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const prUrlOf = (prNumber: number): string =>
      `https://github.com/HiromiShikata/test-repository/pull/${prNumber}`;

    it('resolves every pull request state in one GraphQL request', async () => {
      const prNumbers = [31, 32, 33];
      const capturedVariables: Record<string, unknown>[] = [];
      const fetchSpy = mockFetchRoutes({
        slimPullRequestBatch: (variables) => {
          capturedVariables.push(variables);
          return {
            data: Object.fromEntries(
              prNumbers.map((prNumber, index) => [
                `pullRequest${index}`,
                {
                  pullRequest: buildSlimPullRequestNode({
                    url: prUrlOf(prNumber),
                    headRefName: `feature-${prNumber}`,
                  }),
                },
              ]),
            ),
          };
        },
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'ci', conclusion: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests(
        prNumbers.map(prUrlOf),
      );

      expect(countSlimPullRequestBatchQueries(fetchSpy)).toBe(1);
      expect(capturedVariables).toHaveLength(1);
      expect(capturedVariables[0].prNumber0).toBe(31);
      expect(capturedVariables[0].prNumber2).toBe(33);
      expect(Array.from(resolved.keys())).toEqual(prNumbers.map(prUrlOf));
      for (const prNumber of prNumbers) {
        expect(resolved.get(prUrlOf(prNumber))?.branchName).toBe(
          `feature-${prNumber}`,
        );
      }
    });

    it('resolves a pull request the batch reports as not found to an absent pull request', async () => {
      mockFetchRoutes({
        slimPullRequestBatch: () => ({
          data: { pullRequest0: null },
          errors: [
            {
              message: 'Could not resolve to a PullRequest',
              type: 'NOT_FOUND',
              path: ['pullRequest0', 'pullRequest'],
            },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests([prUrlOf(31)]);

      expect(resolved.has(prUrlOf(31))).toBe(true);
      expect(resolved.get(prUrlOf(31))).toBeNull();
    });

    it('omits a pull request whose alias failed for a reason other than not found so an unknown state is not read as absent', async () => {
      mockFetchRoutes({
        slimPullRequestBatch: () => ({
          data: { pullRequest0: null },
          errors: [
            {
              message: 'Something went wrong while executing your query',
              type: 'SERVICE_UNAVAILABLE',
              path: ['pullRequest0', 'pullRequest'],
            },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests([prUrlOf(31)]);

      expect(resolved.has(prUrlOf(31))).toBe(false);
    });

    it('omits a pull request whose review threads do not fit one page so it is resolved by the paginating path', async () => {
      mockFetchRoutes({
        slimPullRequestBatch: () => ({
          data: {
            pullRequest0: {
              pullRequest: buildSlimPullRequestNode({
                reviewThreads: {
                  pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
                  nodes: [{ isResolved: true }],
                },
              }),
            },
          },
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests([prUrlOf(31)]);

      expect(resolved.has(prUrlOf(31))).toBe(false);
    });

    it('leaves every url of a failed batch unresolved so the caller falls back to the single query', async () => {
      mockFetchRoutes({
        slimPullRequestBatch: () => ({
          data: null,
          errors: [
            { message: 'Something went wrong while executing your query' },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests([
        prUrlOf(31),
        prUrlOf(32),
      ]);

      expect(resolved.size).toBe(0);
    });

    it('resolves an issue url to an absent pull request without issuing any request', async () => {
      const fetchSpy = mockFetchRoutes({});
      const issueUrl =
        'https://github.com/HiromiShikata/test-repository/issues/31';

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests([issueUrl]);

      expect(resolved.get(issueUrl)).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('splits more pull requests than one batch holds into separate GraphQL requests', async () => {
      const prNumbers = Array.from({ length: 101 }, (_, index) => 1000 + index);
      const fetchSpy = mockFetchRoutes({
        slimPullRequestBatch: (variables) => ({
          data: Object.fromEntries(
            Object.keys(variables)
              .filter((name) => name.startsWith('prNumber'))
              .map((name) => [
                `pullRequest${name.slice('prNumber'.length)}`,
                { pullRequest: buildSlimPullRequestNode() },
              ]),
          ),
        }),
        checkRuns: () => ({ total_count: 0, check_runs: [] }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const resolved = await repository.getOpenPullRequests(
        prNumbers.map(prUrlOf),
      );

      expect(countSlimPullRequestBatchQueries(fetchSpy)).toBe(2);
      expect(resolved.size).toBe(prNumbers.length);
    });
  });

  describe('getOpenPullRequest CI state computation', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns isCiStateSuccess true when the latest check run per name is success even though an older run has failure', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            {
              id: 100,
              name: 'check_pull_requests_to_link_issues',
              conclusion: 'failure',
            },
            {
              id: 200,
              name: 'check_pull_requests_to_link_issues',
              conclusion: 'success',
            },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(true);
      expect(result?.isPassedAllCiJob).toBe(true);
    });

    it('returns isCiStateSuccess false when the latest check run per name has failure conclusion', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            { id: 100, name: 'ci', conclusion: 'success' },
            { id: 200, name: 'ci', conclusion: 'failure' },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(false);
      expect(result?.isPassedAllCiJob).toBe(false);
    });

    it('returns isCiStateSuccess false when the latest check run per name has null conclusion (still running)', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            { id: 100, name: 'ci', conclusion: 'failure' },
            { id: 200, name: 'ci', conclusion: null },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(false);
      expect(result?.isPassedAllCiJob).toBe(false);
    });

    it('returns isCiStateSuccess false when a commit status context has failure state', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        combinedStatus: () => ({
          statuses: [{ context: 'external-ci', state: 'failure' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(false);
    });

    it('returns isCiStateSuccess false when the head commit has no check runs and no commit statuses', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(false);
      expect(result?.isPassedAllCiJob).toBe(false);
    });

    it('combines REST check runs and commit statuses into one CI success evaluation', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'unit-test', conclusion: 'success' }],
        }),
        combinedStatus: () => ({
          statuses: [{ context: 'external-ci', state: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(true);
      expect(result?.isPassedAllCiJob).toBe(true);
    });

    it('returns isCiStateSuccess true when check run conclusions are neutral or skipped', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            { id: 100, name: 'lint', conclusion: 'neutral' },
            { id: 200, name: 'docs', conclusion: 'skipped' },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isCiStateSuccess).toBe(true);
      expect(result?.isPassedAllCiJob).toBe(true);
    });
  });

  describe('getOpenPullRequest required check resolution via REST', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('reports missing required checks merged from branch rules and classic branch protection', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: () => [
          {
            type: 'required_status_checks',
            parameters: {
              required_status_checks: [{ context: 'ruleset-check' }],
            },
          },
          { type: 'deletion' },
        ],
        branchDetail: () => ({
          protection: {
            required_status_checks: { contexts: ['classic-check'] },
          },
        }),
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'ruleset-check', conclusion: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.missingRequiredCheckNames).toEqual(['classic-check']);
      expect(result?.isCiStateSuccess).toBe(true);
      expect(result?.isPassedAllCiJob).toBe(false);
    });

    it('passes all required checks when every required check name has reported on the head commit', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: () => [
          {
            type: 'required_status_checks',
            parameters: {
              required_status_checks: [{ context: 'ruleset-check' }],
            },
          },
        ],
        branchDetail: () => ({
          protection: {
            required_status_checks: { contexts: ['classic-check'] },
          },
        }),
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            { id: 1, name: 'ruleset-check', conclusion: 'success' },
            { id: 2, name: 'classic-check', conclusion: 'success' },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.missingRequiredCheckNames).toEqual([]);
      expect(result?.isPassedAllCiJob).toBe(true);
    });

    it('treats HTTP 403 from branch rules and branch detail as no required checks and keeps evaluating the PR', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const planLimitationMessage =
        'Upgrade to GitHub Pro or make this repository public to enable this feature.';
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: () =>
          new Response(JSON.stringify({ message: planLimitationMessage }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        branchDetail: () =>
          new Response(JSON.stringify({ message: planLimitationMessage }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'unit-test', conclusion: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.missingRequiredCheckNames).toEqual([]);
      expect(result?.isCiStateSuccess).toBe(true);
      expect(result?.isPassedAllCiJob).toBe(true);
      const warnMessages = warnSpy.mock.calls.map((call) => String(call[0]));
      expect(
        warnMessages.some(
          (message) =>
            message.includes('branch rules are not accessible') &&
            message.includes(planLimitationMessage),
        ),
      ).toBe(true);
      expect(
        warnMessages.some(
          (message) =>
            message.includes(
              'branch detail (classic protection) is not accessible',
            ) && message.includes(planLimitationMessage),
        ),
      ).toBe(true);
    });

    it('caches the empty result from an HTTP 403 so the branch rules endpoint is not fetched again within the TTL', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      const forbidden = () =>
        new Response(
          JSON.stringify({
            message:
              'Upgrade to GitHub Pro or make this repository public to enable this feature.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      const fetchSpy = mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: forbidden,
        branchDetail: forbidden,
      });

      const { repository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(
        new Date('2026-01-01T00:00:00.000Z'),
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(
        countCallsMatching(fetchSpy, (url) => url.includes('/rules/branches/')),
      ).toBe(1);
      expect(
        countCallsMatching(fetchSpy, (url) => /\/branches\/[^/?]+$/.test(url)),
      ).toBe(1);
    });

    it('treats HTTP 404 from branch rules and branch detail as no required checks without warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: () =>
          new Response(JSON.stringify({ message: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        branchDetail: () =>
          new Response(JSON.stringify({ message: 'Branch not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'unit-test', conclusion: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.missingRequiredCheckNames).toEqual([]);
      expect(result?.isPassedAllCiJob).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('still throws when branch rules fetch fails with a non-403 non-404 status', async () => {
      mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
        branchRules: () =>
          new Response(JSON.stringify({ message: 'Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.getOpenPullRequest(
          'https://github.com/HiromiShikata/test-repository/pull/31',
        ),
      ).rejects.toThrow(/Failed to fetch branch rules/);
    });
  });

  describe('required check names TTL cache', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches branch rules only once for repeated calls on the same base branch within the TTL', async () => {
      const fetchSpy = mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
      });

      const { repository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(
        new Date('2026-01-01T00:00:00.000Z'),
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(
        countCallsMatching(fetchSpy, (url) => url.includes('/rules/branches/')),
      ).toBe(1);
      expect(
        countCallsMatching(fetchSpy, (url) => /\/branches\/[^/?]+$/.test(url)),
      ).toBe(1);
    });

    it('fetches branch rules again after the TTL has expired', async () => {
      const fetchSpy = mockFetchRoutes({
        slimPullRequest: () => buildSlimPullRequestResponse(),
      });

      const { repository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      const baseTimeMs = new Date('2026-01-01T00:00:00.000Z').getTime();
      dateRepository.now
        .mockResolvedValueOnce(new Date(baseTimeMs))
        .mockResolvedValueOnce(
          new Date(baseTimeMs + REQUIRED_CHECKS_CACHE_TTL_MS + 1),
        );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(
        countCallsMatching(fetchSpy, (url) => url.includes('/rules/branches/')),
      ).toBe(2);
    });

    it('fetches branch rules separately for different base branches (cache miss)', async () => {
      const fetchSpy = mockFetchRoutes({
        slimPullRequest: (variables) =>
          buildSlimPullRequestResponse({
            url: `https://github.com/HiromiShikata/test-repository/pull/${variables.prNumber}`,
            baseRefName: variables.prNumber === 31 ? 'main' : 'develop',
          }),
      });

      const { repository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(
        new Date('2026-01-01T00:00:00.000Z'),
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );
      await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/32',
      );

      expect(
        countCallsMatching(fetchSpy, (url) =>
          url.includes('/rules/branches/main'),
        ),
      ).toBe(1);
      expect(
        countCallsMatching(fetchSpy, (url) =>
          url.includes('/rules/branches/develop'),
        ),
      ).toBe(1);
    });
  });

  describe('getOpenPullRequest review thread paging', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches every review thread page and evaluates resolution over all pages', async () => {
      const fetchSpy = mockFetchRoutes({
        slimPullRequest: (variables) =>
          buildSlimPullRequestResponse({
            reviewThreads:
              variables.reviewThreadsAfter === null
                ? {
                    pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
                    nodes: [{ isResolved: true }],
                  }
                : {
                    pageInfo: { endCursor: null, hasNextPage: false },
                    nodes: [{ isResolved: false }],
                  },
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.getOpenPullRequest(
        'https://github.com/HiromiShikata/test-repository/pull/31',
      );

      expect(result).not.toBeNull();
      expect(result?.isResolvedAllReviewComments).toBe(false);
      expect(
        countCallsMatching(
          fetchSpy,
          (url, body) =>
            url === 'https://api.github.com/graphql' &&
            body.includes('headRefOid'),
        ),
      ).toBe(2);
      const secondSlimCall = fetchSpy.mock.calls
        .map(([input, init]): GraphqlRequestBody | null =>
          requestUrlOf(input) === 'https://api.github.com/graphql'
            ? parseGraphqlRequestBody(init)
            : null,
        )
        .filter(
          (body): body is GraphqlRequestBody =>
            body !== null && body.query.includes('headRefOid'),
        )[1];
      expect(secondSlimCall?.variables.reviewThreadsAfter).toBe('cursor-1');
    });
  });

  describe('findRelatedOpenPRs mergeability resolution', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const buildPullRequestTimelineNode = (
      prNumber: number,
      mergeable: string,
    ) => ({
      __typename: 'CrossReferencedEvent',
      willCloseTarget: true,
      source: {
        __typename: 'PullRequest',
        url: `https://github.com/HiromiShikata/test-repository/pull/${prNumber}`,
        number: prNumber,
        state: 'OPEN',
        createdAt: '2024-01-01T00:00:00Z',
        isDraft: false,
        mergeable,
        headRefName: 'feature-branch',
        baseRefName: 'main',
        baseRef: { name: 'main' },
      },
    });

    const buildTimelineResponse = (mergeable: string) => ({
      data: {
        repository: {
          issue: {
            timelineItems: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [buildPullRequestTimelineNode(11148, mergeable)],
            },
          },
        },
      },
    });

    const buildMergeabilityResponse = (
      mergeable: string | null,
      mergeStateStatus: string | null,
    ) => ({
      data: {
        repository: {
          pullRequest: {
            mergeable,
            mergeStateStatus,
          },
        },
      },
    });

    const slimForPrNumber = (variables: { prNumber: number }) =>
      buildSlimPullRequestResponse({
        url: `https://github.com/HiromiShikata/test-repository/pull/${variables.prNumber}`,
      });

    it('resolves isConflicted true via a direct query when the timeline node reports mergeable UNKNOWN but the direct query reports CONFLICTING', async () => {
      const fetchSpy = mockFetchRoutes({
        timeline: () => buildTimelineResponse('UNKNOWN'),
        mergeability: () => buildMergeabilityResponse('CONFLICTING', 'DIRTY'),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(countMergeabilityQueries(fetchSpy)).toBe(1);
      expect(result).toHaveLength(1);
      expect(result[0].isConflicted).toBe(true);
      expect(result[0].mergeable).toBe('CONFLICTING');
    });

    it('resolves isConflicted true when the direct query returns mergeable UNKNOWN but mergeStateStatus DIRTY', async () => {
      mockFetchRoutes({
        timeline: () => buildTimelineResponse('UNKNOWN'),
        mergeability: () => buildMergeabilityResponse('UNKNOWN', 'DIRTY'),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isConflicted).toBe(true);
    });

    it('keeps isConflicted false when mergeability stays UNKNOWN after the bounded retries', async () => {
      const fetchSpy = mockFetchRoutes({
        timeline: () => buildTimelineResponse('UNKNOWN'),
        mergeability: () => buildMergeabilityResponse('UNKNOWN', 'UNKNOWN'),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(countMergeabilityQueries(fetchSpy)).toBe(3);
      expect(result).toHaveLength(1);
      expect(result[0].isConflicted).toBe(false);
    });

    it('does not issue a direct mergeability query when the timeline node already reports a definitive mergeable value', async () => {
      const fetchSpy = mockFetchRoutes({
        timeline: () => buildTimelineResponse('MERGEABLE'),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(countMergeabilityQueries(fetchSpy)).toBe(0);
      expect(result).toHaveLength(1);
      expect(result[0].isConflicted).toBe(false);
      expect(result[0].mergeable).toBe('MERGEABLE');
    });

    it('skips null timeline nodes and returns the remaining pull requests', async () => {
      mockFetchRoutes({
        timeline: () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { endCursor: null, hasNextPage: false },
                  nodes: [
                    null,
                    buildPullRequestTimelineNode(11148, 'MERGEABLE'),
                    null,
                  ],
                },
              },
            },
          },
        }),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/test-repository/pull/11148',
      );
    });

    it('returns an empty list when the timeline items object is null', async () => {
      mockFetchRoutes({
        timeline: () => ({
          data: {
            repository: {
              issue: {
                timelineItems: null,
              },
            },
          },
        }),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toEqual([]);
    });

    it('logs a warning per null timeline node and returns an empty array when all nodes are null', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              repository: {
                issue: {
                  timelineItems: {
                    pageInfo: { endCursor: null, hasNextPage: false },
                    nodes: [null, null],
                  },
                },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/issues/11194',
        ),
      );
    });

    const buildTwoPrTimelineResponse = () => ({
      data: {
        repository: {
          issue: {
            timelineItems: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [
                buildPullRequestTimelineNode(11148, 'UNKNOWN'),
                buildPullRequestTimelineNode(11149, 'MERGEABLE'),
              ],
            },
          },
        },
      },
    });

    it('excludes a PR whose mergeability resolution reports NOT_FOUND and still returns the healthy PR in the same batch', async () => {
      const consoleInfoSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      mockFetchRoutes({
        timeline: () => buildTwoPrTimelineResponse(),
        mergeability: () => ({
          data: { repository: { pullRequest: null } },
          errors: [
            {
              type: 'NOT_FOUND',
              path: ['repository', 'pullRequest'],
              message:
                'Could not resolve to a PullRequest with the number of 11148.',
            },
          ],
        }),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/test-repository/pull/11149',
      );
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/pull/11148',
        ),
      );
    });

    it('skips a PR whose mergeability resolution fails with a generic error, logs one warning, and still returns the healthy PR in the same batch', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockFetchRoutes({
        timeline: () => buildTwoPrTimelineResponse(),
        mergeability: () =>
          new Response('Internal Server Error', { status: 500 }),
        slimPullRequest: slimForPrNumber,
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/test-repository/pull/11149',
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/pull/11148',
        ),
      );
    });
  });

  describe('findRelatedOpenPRs two-stage split', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const buildSlimTimelineResponse = () => ({
      data: {
        repository: {
          issue: {
            timelineItems: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [
                {
                  __typename: 'CrossReferencedEvent',
                  willCloseTarget: true,
                  source: {
                    __typename: 'PullRequest',
                    url: 'https://github.com/HiromiShikata/test-repository/pull/11148',
                    number: 11148,
                    state: 'OPEN',
                    createdAt: '2024-01-01T00:00:00Z',
                    isDraft: false,
                    mergeable: 'MERGEABLE',
                    headRefName: 'feature-branch',
                    baseRefName: 'main',
                    baseRef: { name: 'main' },
                  },
                },
              ],
            },
          },
        },
      },
    });

    it('produces the same evaluation inputs from the two-stage flow and sends no nested rules connections in any GraphQL query', async () => {
      const fetchSpy = mockFetchRoutes({
        timeline: () => buildSlimTimelineResponse(),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/test-repository/pull/11148',
            reviewThreads: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [{ isResolved: true }],
            },
          }),
        branchRules: () => [
          {
            type: 'required_status_checks',
            parameters: { required_status_checks: [{ context: 'ci' }] },
          },
        ],
        checkRuns: () => ({
          total_count: 1,
          check_runs: [{ id: 1, name: 'ci', conclusion: 'success' }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://github.com/HiromiShikata/test-repository/pull/11148',
        branchName: 'feature-branch',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        isDraft: false,
        isConflicted: false,
        mergeable: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });
      expect(
        countCallsMatching(
          fetchSpy,
          (url, body) =>
            url === 'https://api.github.com/graphql' &&
            (body.includes('branchProtectionRules') ||
              body.includes('rulesets') ||
              body.includes('statusCheckRollup')),
        ),
      ).toBe(0);
    });

    it('excludes a PR that is no longer open at the second stage', async () => {
      const consoleInfoSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      mockFetchRoutes({
        timeline: () => buildSlimTimelineResponse(),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({ state: 'MERGED' }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(0);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/pull/11148',
        ),
      );
    });

    it('skips a PR whose second-stage status fetch fails and logs one warning', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      mockFetchRoutes({
        timeline: () => buildSlimTimelineResponse(),
        slimPullRequest: () =>
          new Response('Internal Server Error', { status: 500 }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/pull/11148',
        ),
      );
    });

    it('reports isCiStateSuccess true when an older check-run record with the same name has failure but the newer record has success', async () => {
      mockFetchRoutes({
        timeline: () => buildSlimTimelineResponse(),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/test-repository/pull/11148',
            reviewThreads: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [],
            },
          }),
        branchRules: () => [],
        checkRuns: () => ({
          total_count: 2,
          check_runs: [
            { id: 100, name: 'ci', conclusion: 'failure' },
            { id: 200, name: 'ci', conclusion: 'success' },
          ],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/11194',
      );

      expect(result).toHaveLength(1);
      expect(result[0].isCiStateSuccess).toBe(true);
      expect(result[0].isPassedAllCiJob).toBe(true);
    });
  });

  describe('findRelatedOpenPRs cross-repo PR', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('queries the PR repository owner and name when the PR is in a different repository than the issue', async () => {
      const capturedSlimVariables: Array<{
        owner?: string;
        repo?: string;
        prNumber: number;
      }> = [];

      mockFetchRoutes({
        timeline: () => ({
          data: {
            repository: {
              issue: {
                timelineItems: {
                  pageInfo: { endCursor: null, hasNextPage: false },
                  nodes: [
                    {
                      __typename: 'CrossReferencedEvent',
                      willCloseTarget: true,
                      source: {
                        __typename: 'PullRequest',
                        url: 'https://github.com/HiromiShikata/secretary/pull/2751',
                        number: 2751,
                        state: 'OPEN',
                        createdAt: '2024-01-01T00:00:00Z',
                        isDraft: false,
                        mergeable: 'MERGEABLE',
                        headRefName: 'close-ufw-port-9981-i30106',
                        baseRefName: 'main',
                        baseRef: { name: 'main' },
                      },
                    },
                  ],
                },
              },
            },
          },
        }),
        slimPullRequest: (variables) => {
          capturedSlimVariables.push(variables);
          return buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/secretary/pull/2751',
          });
        },
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/acme-corporait-operation/issues/30106',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/secretary/pull/2751',
      );
      expect(capturedSlimVariables).toHaveLength(1);
      expect(capturedSlimVariables[0].owner).toBe('HiromiShikata');
      expect(capturedSlimVariables[0].repo).toBe('secretary');
      expect(capturedSlimVariables[0].prNumber).toBe(2751);
    });
  });

  describe('findRelatedOpenPRs', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const buildTimelineResponse = (nodes: unknown[]) => ({
      data: {
        repository: {
          issue: {
            timelineItems: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes,
            },
          },
        },
      },
    });

    const buildCrossReferencedEventNode = (overrides: {
      willCloseTarget: boolean;
      prUrl: string;
      prState: string;
      prBody?: string | null;
      headRefName?: string;
      baseRefName?: string;
    }) => ({
      __typename: 'CrossReferencedEvent',
      willCloseTarget: overrides.willCloseTarget,
      source: {
        __typename: 'PullRequest',
        url: overrides.prUrl,
        number: 427,
        body: overrides.prBody ?? null,
        state: overrides.prState,
        createdAt: '2024-01-01T00:00:00Z',
        isDraft: false,
        mergeable: 'MERGEABLE',
        headRefName: overrides.headRefName ?? 'feature-branch',
        baseRefName: overrides.baseRefName ?? 'main',
        baseRepository: {
          branchProtectionRules: { nodes: [] },
          defaultBranchRef: { name: 'main' },
          rulesets: { nodes: [] },
        },
        commits: {
          nodes: [
            {
              commit: {
                statusCheckRollup: {
                  contexts: { nodes: [] },
                },
              },
            },
          ],
        },
        reviewThreads: { nodes: [] },
        baseRef: { name: 'main' },
      },
    });

    it('returns an empty array when no cross-referenced events exist', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(buildTimelineResponse([])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toEqual([]);
    });

    it('returns the PR when willCloseTarget is true (same-repo PR, standard behavior)', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: true,
              prUrl: 'https://github.com/HiromiShikata/secretary/pull/100',
              prState: 'OPEN',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/secretary/pull/100',
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/secretary/pull/100',
      );
    });

    it('excludes the PR when willCloseTarget is false and the PR body does not contain a closing keyword referencing the issue URL', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildTimelineResponse([
              buildCrossReferencedEventNode({
                willCloseTarget: false,
                prUrl:
                  'https://github.com/HiromiShikata/repositories-management/pull/427',
                prState: 'OPEN',
                prBody: 'This PR fixes something unrelated.',
              }),
            ]),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toEqual([]);
    });

    it('includes the cross-repo PR when willCloseTarget is false but the PR body contains "Closes {issueUrl}"', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: false,
              prUrl:
                'https://github.com/HiromiShikata/repositories-management/pull/427',
              prState: 'OPEN',
              prBody:
                'Closes https://github.com/HiromiShikata/secretary/issues/2380',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/repositories-management/pull/427',
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/repositories-management/pull/427',
      );
    });

    it('includes the cross-repo PR when willCloseTarget is false but the PR body contains "Fixes {issueUrl}" (case-insensitive)', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: false,
              prUrl:
                'https://github.com/HiromiShikata/repositories-management/pull/427',
              prState: 'OPEN',
              prBody:
                'FIXES https://github.com/HiromiShikata/secretary/issues/2380',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/repositories-management/pull/427',
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/repositories-management/pull/427',
      );
    });

    it('includes the cross-repo PR when willCloseTarget is false but the PR body contains "Resolves {issueUrl}"', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: false,
              prUrl:
                'https://github.com/HiromiShikata/repositories-management/pull/427',
              prState: 'OPEN',
              prBody:
                'Resolves https://github.com/HiromiShikata/secretary/issues/2380',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/repositories-management/pull/427',
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/repositories-management/pull/427',
      );
    });

    it('excludes the PR when willCloseTarget is false, the body has a closing keyword, but the URL references a different issue', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildTimelineResponse([
              buildCrossReferencedEventNode({
                willCloseTarget: false,
                prUrl:
                  'https://github.com/HiromiShikata/repositories-management/pull/427',
                prState: 'OPEN',
                prBody:
                  'Closes https://github.com/HiromiShikata/secretary/issues/9999',
              }),
            ]),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toEqual([]);
    });

    it('excludes the cross-repo PR when it is not in OPEN state even if the body contains a closing keyword', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildTimelineResponse([
              buildCrossReferencedEventNode({
                willCloseTarget: false,
                prUrl:
                  'https://github.com/HiromiShikata/repositories-management/pull/427',
                prState: 'MERGED',
                prBody:
                  'Closes https://github.com/HiromiShikata/secretary/issues/2380',
              }),
            ]),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toEqual([]);
    });

    it('includes the cross-repo PR when willCloseTarget is false but the PR body contains "closes" followed by the issue URL with a trailing slash', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: false,
              prUrl:
                'https://github.com/HiromiShikata/repositories-management/pull/427',
              prState: 'OPEN',
              prBody:
                'closes https://github.com/HiromiShikata/secretary/issues/2380/',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/repositories-management/pull/427',
          }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/repositories-management/pull/427',
      );
    });

    it('includes the PR when commits/{sha}/check-runs returns 404 and check-suites fallback succeeds', async () => {
      mockFetchRoutes({
        timeline: () =>
          buildTimelineResponse([
            buildCrossReferencedEventNode({
              willCloseTarget: true,
              prUrl: 'https://github.com/HiromiShikata/secretary/pull/100',
              prState: 'OPEN',
            }),
          ]),
        slimPullRequest: () =>
          buildSlimPullRequestResponse({
            url: 'https://github.com/HiromiShikata/secretary/pull/100',
            headRefOid: 'sha-fork-commit',
          }),
        checkRuns: (url) => {
          if (url.includes('/commits/sha-fork-commit/check-runs')) {
            return new Response(JSON.stringify({ message: 'Not Found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return {
            total_count: 1,
            check_runs: [{ id: 1, name: 'ci', conclusion: 'success' }],
          };
        },
        checkSuites: () => ({
          total_count: 1,
          check_suites: [{ id: 55 }],
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/2380',
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(
        'https://github.com/HiromiShikata/secretary/pull/100',
      );
      expect(result[0].isPassedAllCiJob).toBe(true);
    });

    it('returns an empty array when the GraphQL response reports the issue does not exist', async () => {
      const consoleInfoSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      mockFetchRoutes({
        timeline: () => ({
          data: {
            repository: {
              issue: null,
            },
          },
        }),
      });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/test-repository/issues/99999',
      );

      expect(result).toEqual([]);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/HiromiShikata/test-repository/issues/99999',
        ),
      );
    });
  });

  describe('findRelatedOpenPRs TTL cache', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const buildEmptyTimelineResponse = () => ({
      data: {
        repository: {
          issue: {
            timelineItems: {
              pageInfo: { endCursor: null, hasNextPage: false },
              nodes: [],
            },
          },
        },
      },
    });

    it('returns cached result and issues no additional GraphQL query on second call within TTL', async () => {
      const { repository, localStorageCacheRepository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      const t = new Date('2026-01-01T00:00:00.000Z');
      dateRepository.now.mockResolvedValue(t);

      const timelineFn = jest.fn(() => buildEmptyTimelineResponse());
      mockFetchRoutes({ timeline: timelineFn });

      const cachedEntry = { fetchedAtMs: t.getTime(), prs: [] };
      localStorageCacheRepository.getSingle
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(cachedEntry);
      localStorageCacheRepository.setSingle.mockResolvedValue(undefined);

      const issueUrl = 'https://github.com/HiromiShikata/secretary/issues/100';
      await repository.findRelatedOpenPRs(issueUrl);
      const result = await repository.findRelatedOpenPRs(issueUrl);

      expect(timelineFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('issues a new GraphQL query after the TTL has elapsed', async () => {
      const { repository, localStorageCacheRepository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      const t0 = new Date('2026-01-01T00:00:00.000Z');
      const tExpired = new Date(t0.getTime() + RELATED_OPEN_PRS_CACHE_TTL_MS);
      dateRepository.now
        .mockResolvedValueOnce(t0)
        .mockResolvedValueOnce(tExpired);

      const timelineFn = jest.fn(() => buildEmptyTimelineResponse());
      mockFetchRoutes({ timeline: timelineFn });

      const staleEntry = { fetchedAtMs: t0.getTime(), prs: [] };
      localStorageCacheRepository.getSingle
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(staleEntry);
      localStorageCacheRepository.setSingle.mockResolvedValue(undefined);

      const issueUrl = 'https://github.com/HiromiShikata/secretary/issues/100';
      await repository.findRelatedOpenPRs(issueUrl);
      await repository.findRelatedOpenPRs(issueUrl);

      expect(timelineFn).toHaveBeenCalledTimes(2);
    });

    it('does not share cache between different issue URLs', async () => {
      const { repository, localStorageCacheRepository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      dateRepository.now.mockResolvedValue(
        new Date('2026-01-01T00:00:00.000Z'),
      );

      const timelineFn = jest.fn(() => buildEmptyTimelineResponse());
      mockFetchRoutes({ timeline: timelineFn });

      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      localStorageCacheRepository.setSingle.mockResolvedValue(undefined);

      await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/100',
      );
      await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/200',
      );

      expect(timelineFn).toHaveBeenCalledTimes(2);
    });

    it('uses the correct cache key per issue and writes to localStorageCacheRepository', async () => {
      const { repository, localStorageCacheRepository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      const t = new Date('2026-01-01T00:00:00.000Z');
      dateRepository.now.mockResolvedValue(t);

      mockFetchRoutes({
        timeline: jest.fn(() => buildEmptyTimelineResponse()),
      });

      localStorageCacheRepository.getSingle.mockResolvedValue(null);
      localStorageCacheRepository.setSingle.mockResolvedValue(undefined);

      await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/100',
      );

      expect(localStorageCacheRepository.getSingle).toHaveBeenCalledWith(
        'related-open-prs/HiromiShikata/secretary/100',
      );
      expect(localStorageCacheRepository.setSingle).toHaveBeenCalledWith(
        'related-open-prs/HiromiShikata/secretary/100',
        expect.objectContaining({ fetchedAtMs: t.getTime(), prs: [] }),
      );
    });

    it('deserializes Date from cached ISO string when returning a cache hit', async () => {
      const { repository, localStorageCacheRepository, dateRepository } =
        createApiV3CheerioRestIssueRepository();
      const t = new Date('2026-01-01T00:00:00.000Z');
      dateRepository.now.mockResolvedValue(t);

      localStorageCacheRepository.setSingle.mockResolvedValue(undefined);

      const prCreatedAt = '2025-06-01T12:00:00.000Z';
      const cachedEntry = {
        fetchedAtMs: t.getTime(),
        prs: [
          {
            url: 'https://github.com/HiromiShikata/secretary/pull/50',
            branchName: 'feature/x',
            createdAt: prCreatedAt,
            isDraft: false,
            isConflicted: false,
            mergeable: 'MERGEABLE',
            isPassedAllCiJob: true,
            isCiStateSuccess: true,
            isResolvedAllReviewComments: true,
            isBranchOutOfDate: false,
            missingRequiredCheckNames: [],
          },
        ],
      };
      localStorageCacheRepository.getSingle.mockResolvedValue(cachedEntry);

      const result = await repository.findRelatedOpenPRs(
        'https://github.com/HiromiShikata/secretary/issues/100',
      );

      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].createdAt.toISOString()).toBe(prCreatedAt);
    });
  });

  describe('getOpenPullRequestCiStatus', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const prUrl = 'https://github.com/HiromiShikata/test-repository/pull/42';

    const jsonResponse = (body: unknown): Response =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const openPullRequestBody = (mergeable: boolean | null): unknown => ({
      html_url: prUrl,
      state: 'open',
      draft: false,
      mergeable,
      created_at: '2024-01-01T00:00:00Z',
      head: { ref: 'feature/x', sha: 'sha-1' },
      base: { ref: 'main' },
    });

    const requestedUrl = (input: RequestInfo | URL): string => {
      if (typeof input === 'string') {
        return input;
      }
      if (input instanceof URL) {
        return input.href;
      }
      return input.url;
    };

    const mockGitHubRest = (pullRequestBodies: unknown[]): string[] => {
      const requestedUrls: string[] = [];
      let pullRequestReadCount = 0;
      jest
        .spyOn(global, 'fetch')
        .mockImplementation((input: RequestInfo | URL): Promise<Response> => {
          const url = requestedUrl(input);
          requestedUrls.push(url);
          if (url.includes('/pulls/42')) {
            const index = Math.min(
              pullRequestReadCount,
              pullRequestBodies.length - 1,
            );
            pullRequestReadCount += 1;
            return Promise.resolve(jsonResponse(pullRequestBodies[index]));
          }
          if (url.includes('/rules/branches/')) {
            return Promise.resolve(jsonResponse([]));
          }
          if (url.includes('/branches/')) {
            return Promise.resolve(jsonResponse({}));
          }
          if (url.includes('/check-runs')) {
            return Promise.resolve(
              jsonResponse({
                total_count: 1,
                check_runs: [{ name: 'test', conclusion: 'success', id: 1 }],
              }),
            );
          }
          if (url.includes('/status')) {
            return Promise.resolve(jsonResponse({ statuses: [] }));
          }
          return Promise.reject(new Error(`unexpected request: ${url}`));
        });
      return requestedUrls;
    };

    it('resolves every status field over REST without issuing a GraphQL request', async () => {
      const requestedUrls = mockGitHubRest([openPullRequestBody(true)]);

      const { repository } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status).toEqual({
        url: prUrl,
        branchName: 'feature/x',
        createdAt: '2024-01-01T00:00:00Z',
        isDraft: false,
        isConflicted: false,
        mergeable: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });
      expect(
        requestedUrls.filter((url) => url.includes('/graphql')),
      ).toHaveLength(0);
      expect(requestedUrls).toContain(
        'https://api.github.com/repos/HiromiShikata/test-repository/pulls/42',
      );
    });

    it('reports a conflicting pull request as conflicted', async () => {
      mockGitHubRest([openPullRequestBody(false)]);

      const { repository } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status?.isConflicted).toBe(true);
      expect(status?.mergeable).toBe('CONFLICTING');
    });

    it('re-reads while GitHub is still computing mergeability and returns the settled value', async () => {
      const requestedUrls = mockGitHubRest([
        openPullRequestBody(null),
        openPullRequestBody(true),
      ]);

      const { repository, sleep } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status?.mergeable).toBe('MERGEABLE');
      expect(sleep).toHaveBeenCalledTimes(1);
      const pullRequestReads = requestedUrls.filter((url) =>
        url.endsWith('/pulls/42'),
      );
      expect(pullRequestReads).toHaveLength(2);
    });

    it('reports unknown mergeability rather than looping when GitHub never settles it', async () => {
      const requestedUrls = mockGitHubRest([openPullRequestBody(null)]);

      const { repository } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status?.mergeable).toBe('UNKNOWN');
      expect(status?.isConflicted).toBe(false);
      const pullRequestReads = requestedUrls.filter((url) =>
        url.endsWith('/pulls/42'),
      );
      expect(pullRequestReads).toHaveLength(3);
    });

    it('returns null for a pull request that is no longer open', async () => {
      mockGitHubRest([
        {
          html_url: prUrl,
          state: 'closed',
          draft: false,
          mergeable: null,
          created_at: '2024-01-01T00:00:00Z',
          head: { ref: 'feature/x', sha: 'sha-1' },
          base: { ref: 'main' },
        },
      ]);

      const { repository } = createApiV3CheerioRestIssueRepository();

      expect(await repository.getOpenPullRequestCiStatus(prUrl)).toBeNull();
    });

    it('returns null for a url that is not a pull request', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const { repository } = createApiV3CheerioRestIssueRepository();

      expect(
        await repository.getOpenPullRequestCiStatus(
          'https://github.com/HiromiShikata/test-repository/issues/42',
        ),
      ).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('falls back to check-suites when commits/{sha}/check-runs returns 404', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest
        .spyOn(global, 'fetch')
        .mockImplementation((input: RequestInfo | URL): Promise<Response> => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url.includes('/pulls/42')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  html_url: prUrl,
                  state: 'open',
                  draft: false,
                  mergeable: true,
                  created_at: '2024-01-01T00:00:00Z',
                  head: { ref: 'feature/x', sha: 'sha-1' },
                  base: { ref: 'main' },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }
          if (url.includes('/rules/branches/')) {
            return Promise.resolve(
              new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          if (/\/branches\/[^/?]+$/.test(url)) {
            return Promise.resolve(
              new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          if (url.includes('/commits/sha-1/check-runs')) {
            return Promise.resolve(
              new Response(JSON.stringify({ message: 'Not Found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          if (url.includes('/commits/sha-1/check-suites')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  total_count: 1,
                  check_suites: [{ id: 99 }],
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }
          if (url.includes('/check-suites/99/check-runs')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  total_count: 1,
                  check_runs: [
                    { id: 1, name: 'unit-test', conclusion: 'success' },
                  ],
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }
          return Promise.reject(new Error(`unexpected request: ${url}`));
        });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status).not.toBeNull();
      expect(status?.isPassedAllCiJob).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs a warning and treats as no check runs when both commits/{sha}/check-runs and commits/{sha}/check-suites return 404', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest
        .spyOn(global, 'fetch')
        .mockImplementation((input: RequestInfo | URL): Promise<Response> => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url.includes('/pulls/42')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  html_url: prUrl,
                  state: 'open',
                  draft: false,
                  mergeable: true,
                  created_at: '2024-01-01T00:00:00Z',
                  head: { ref: 'feature/x', sha: 'sha-1' },
                  base: { ref: 'main' },
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              ),
            );
          }
          if (url.includes('/rules/branches/')) {
            return Promise.resolve(
              new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          if (/\/branches\/[^/?]+$/.test(url)) {
            return Promise.resolve(
              new Response(JSON.stringify({}), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          if (url.includes('/check-runs') || url.includes('/check-suites')) {
            return Promise.resolve(
              new Response(JSON.stringify({ message: 'Not Found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }
          return Promise.reject(new Error(`unexpected request: ${url}`));
        });

      const { repository } = createApiV3CheerioRestIssueRepository();
      const status = await repository.getOpenPullRequestCiStatus(prUrl);

      expect(status).not.toBeNull();
      expect(status?.isCiStateSuccess).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('check-suites returned 404'),
      );
    });
  });

  describe('updateStoryOptionColor', () => {
    it('preserves all other option ids and colors and changes only the target option color', async () => {
      const storyProject: Project & {
        story: NonNullable<Project['story']>;
      } = {
        ...buildTestProject('PVT_test'),
        story: {
          name: 'Story',
          fieldId: 'storyField',
          databaseId: 1,
          stories: [
            { id: 'opt_a', name: 'Alpha', color: 'BLUE', description: '' },
            { id: 'opt_b', name: 'Beta', color: 'GREEN', description: '' },
            { id: 'opt_c', name: 'Gamma', color: 'YELLOW', description: '' },
          ],
          workflowManagementStory: { id: 'wms', name: 'workflow' },
        },
      };

      let capturedBody: unknown;
      jest
        .spyOn(global, 'fetch')
        .mockImplementationOnce(async (input): Promise<Response> => {
          const req = input instanceof Request ? input : new Request(input);
          capturedBody = JSON.parse(await req.text());
          return new Response(
            JSON.stringify({
              data: {
                updateProjectV2Field: {
                  projectV2Field: { options: [] },
                },
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        });

      const { repository } = createApiV3CheerioRestIssueRepository();
      await repository.updateStoryOptionColor(storyProject, 'opt_b', 'RED');

      expect(capturedBody).toMatchObject({
        variables: {
          fieldId: 'storyField',
          options: [
            { id: 'opt_a', name: 'Alpha', color: 'BLUE', description: '' },
            { id: 'opt_b', name: 'Beta', color: 'RED', description: '' },
            { id: 'opt_c', name: 'Gamma', color: 'YELLOW', description: '' },
          ],
        },
      });
    });

    it('throws when the GitHub GraphQL response contains errors', async () => {
      const storyProject: Project & {
        story: NonNullable<Project['story']>;
      } = {
        ...buildTestProject('PVT_test'),
        story: {
          name: 'Story',
          fieldId: 'storyField',
          databaseId: 1,
          stories: [
            { id: 'opt_a', name: 'Alpha', color: 'BLUE', description: '' },
          ],
          workflowManagementStory: { id: 'wms', name: 'workflow' },
        },
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [{ message: 'insufficient permissions' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const { repository } = createApiV3CheerioRestIssueRepository();
      await expect(
        repository.updateStoryOptionColor(storyProject, 'opt_a', 'RED'),
      ).rejects.toThrow('insufficient permissions');
    });
  });

  const createApiV3CheerioRestIssueRepository = () => {
    const apiV3IssueRepository = mock<ApiV3IssueRepository>();
    const restIssueRepository = mock<RestIssueRepository>();
    const graphqlProjectItemRepository = mock<GraphqlProjectItemRepository>();
    const localStorageCacheRepository = mock<LocalStorageCacheRepository>();
    const projectRepository = mock<ProjectRepository>();
    const dateRepository = mock<DateRepository>();
    const localStorageRepository = mock<LocalStorageRepository>();
    const sleep = jest.fn().mockResolvedValue(undefined);

    const repository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      projectRepository,
      dateRepository,
      localStorageRepository,
      'dummy',
      sleep,
    );
    dateRepository.now.mockResolvedValue(new Date('2026-01-01T00:00:00.000Z'));
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
      projectRepository,
      dateRepository,
      sleep,
    };
  };
});
