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

import { mock } from 'jest-mock-extended';
import { ProjectIssuesCacheRepository } from './ProjectIssuesCacheRepository';
import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { ApiV3CheerioRestIssueRepository } from './issue/ApiV3CheerioRestIssueRepository';
import { ApiV3IssueRepository } from './issue/ApiV3IssueRepository';
import { RestIssueRepository } from './issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from './issue/GraphqlProjectItemRepository';
import { ProjectRepository } from '../../domain/usecases/adapter-interfaces/ProjectRepository';
import { DateRepository } from '../../domain/usecases/adapter-interfaces/DateRepository';
import { FieldOption, Project } from '../../domain/entities/Project';

const projectId = 'PVT_project123';
const storyFieldId = 'PVTSSF_story';
const statusFieldId = 'PVTSSF_status';

const cachedProject: Project = {
  id: projectId,
  url: 'https://github.com/users/owner/projects/49',
  databaseId: 1,
  name: 'A project',
  status: {
    name: 'Status',
    fieldId: statusFieldId,
    statuses: [{ id: 'st1', name: 'Todo', color: 'GRAY', description: '' }],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'story',
    fieldId: storyFieldId,
    databaseId: 2,
    stories: [
      { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
    ],
    workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
};

const savedStoryOptions: FieldOption[] = [
  { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
  {
    id: 'newStoryId1',
    name: 'New Feature Request',
    color: 'RED',
    description: '',
  },
];

const buildSharedCache = (): Pick<
  LocalStorageCacheRepository,
  'getLatest' | 'set' | 'getSingle' | 'setSingle'
> => {
  const store = new Map<string, unknown>();
  return {
    getLatest: async () => null,
    set: async () => undefined,
    getSingle: async (key: string) => store.get(key) ?? null,
    setSingle: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
};

const buildIssueRepository = (
  cache: Pick<LocalStorageCacheRepository, 'getSingle' | 'setSingle'>,
  localStorageRepository: LocalStorageRepository,
): ApiV3CheerioRestIssueRepository =>
  new ApiV3CheerioRestIssueRepository(
    mock<ApiV3IssueRepository>(),
    mock<RestIssueRepository>(),
    mock<GraphqlProjectItemRepository>(),
    cache,
    mock<ProjectRepository>(),
    mock<DateRepository>(),
    localStorageRepository,
    'dummy',
  );

const seedCache = async (
  cache: Pick<LocalStorageCacheRepository, 'getSingle' | 'setSingle'>,
): Promise<void> => {
  await new ProjectIssuesCacheRepository(cache).write(projectId, {
    lastFetchedAt: '2026-01-01T00:00:00.000Z',
    lastFullFetchAt: '2026-01-01T00:00:00.000Z',
    project: cachedProject,
    issues: [],
  });
};

describe('project issues cache shared by the project repository and the issue repository', () => {
  const localStorageRepository = new LocalStorageRepository();

  beforeEach(() => {
    mockPost.mockReset();
  });

  it('serves the story options written by updateStoryList to the issue repository reader', async () => {
    const cache = buildSharedCache();
    await seedCache(cache);
    mockPost.mockReturnValueOnce({
      json: jest.fn().mockResolvedValue({
        data: {
          updateProjectV2Field: {
            projectV2Field: { options: savedStoryOptions },
          },
        },
      }),
    });
    const projectRepository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy',
      cache,
    );

    await projectRepository.updateStoryList(cachedProject, [
      { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
      { id: null, name: 'New Feature Request', color: 'RED', description: '' },
    ]);

    const project = await buildIssueRepository(
      cache,
      localStorageRepository,
    ).getCachedProject(projectId);

    expect(project?.story?.stories).toEqual(savedStoryOptions);
  });

  it('leaves the cached issues and the fetch timestamps untouched when it writes the story options through', async () => {
    const cache = buildSharedCache();
    await seedCache(cache);
    mockPost.mockReturnValueOnce({
      json: jest.fn().mockResolvedValue({
        data: {
          updateProjectV2Field: {
            projectV2Field: { options: savedStoryOptions },
          },
        },
      }),
    });
    const projectRepository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy',
      cache,
    );

    await projectRepository.updateStoryList(cachedProject, [
      { id: null, name: 'New Feature Request', color: 'RED', description: '' },
    ]);

    const cached = await new ProjectIssuesCacheRepository(cache).read(
      projectId,
    );

    expect(cached?.lastFetchedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(cached?.lastFullFetchAt).toBe('2026-01-01T00:00:00.000Z');
    expect(cached?.issues).toEqual([]);
    expect(cached?.project.status.statuses).toEqual(
      cachedProject.status.statuses,
    );
  });

  it('serves the status options written by updateStatusList to the issue repository reader', async () => {
    const savedStatusOptions: FieldOption[] = [
      { id: 'st1', name: 'Todo', color: 'GRAY', description: '' },
      { id: 'st2', name: 'In Progress', color: 'BLUE', description: '' },
    ];
    const cache = buildSharedCache();
    await seedCache(cache);
    mockPost.mockReturnValueOnce({
      json: jest.fn().mockResolvedValue({
        data: {
          updateProjectV2Field: {
            projectV2Field: { options: savedStatusOptions },
          },
        },
      }),
    });
    const projectRepository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy',
      cache,
    );

    await projectRepository.updateStatusList(cachedProject, [
      { id: 'st1', name: 'Todo', color: 'GRAY', description: '' },
      { id: null, name: 'In Progress', color: 'BLUE', description: '' },
    ]);

    const project = await buildIssueRepository(
      cache,
      localStorageRepository,
    ).getCachedProject(projectId);

    expect(project?.status.statuses).toEqual(savedStatusOptions);
  });
});
