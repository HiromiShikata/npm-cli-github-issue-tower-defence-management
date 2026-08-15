const mockGet = jest.fn();
const mockPostGithubGraphqlJson = jest.fn();

jest.mock('ky', () => ({
  default: {
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    extend: jest.fn(),
    create: jest.fn(),
    stop: jest.fn(),
  },
  __esModule: true,
}));

jest.mock('./githubGraphqlClient', () => ({
  postGithubGraphqlJson: mockPostGithubGraphqlJson,
}));

import { GraphqlProjectRepository } from './GraphqlProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const projectId = 'PVT_kwHOAGJHa84AFWnr';
const projectUrl = 'https://github.com/users/HiromiShikata/projects/48';

const restProjectResponse = {
  id: 1403371,
  node_id: projectId,
  title: 'UMINO',
};

const restFieldsResponse = [
  {
    id: 12940049,
    node_id: 'PVTSSF_status',
    name: 'Status',
    options: [
      {
        id: 'f75ad846',
        name: { html: 'Unread', raw: 'Unread' },
        description: { html: '', raw: '' },
        color: 'ORANGE',
      },
    ],
  },
];

const graphqlProjectResponse = {
  data: {
    node: {
      id: projectId,
      databaseId: 1403371,
      title: 'UMINO',
      shortDescription: '',
      public: true,
      closed: false,
      createdAt: '2022-08-27T01:26:40Z',
      updatedAt: '2026-07-24T08:49:59Z',
      number: 48,
      url: projectUrl,
      fields: {
        nodes: [
          {
            id: 'PVTSSF_status',
            databaseId: 12940049,
            name: 'Status',
            dataType: 'SINGLE_SELECT',
            options: [
              {
                id: 'f75ad846',
                name: 'Unread',
                description: '',
                color: 'ORANGE',
              },
            ],
          },
        ],
      },
    },
  },
};

const buildProjectCache = () => {
  const stored = new Map<string, unknown>();
  return {
    stored,
    getLatest: jest.fn(async (key: string) => {
      const value = stored.get(key);
      if (typeof value !== 'object' || value === null) {
        return null;
      }
      return { value, timestamp: new Date('2026-08-15T00:00:00Z') };
    }),
    set: jest.fn(async (key: string, value: unknown) => {
      stored.set(key, value);
    }),
    getSingle: jest.fn(async () => null),
    setSingle: jest.fn(async () => undefined),
  };
};

describe('GraphqlProjectRepository project location', () => {
  const localStorageRepository = new LocalStorageRepository();

  beforeEach(() => {
    mockGet.mockReset();
    mockPostGithubGraphqlJson.mockReset();
    mockGet.mockImplementation((url: string) =>
      url.endsWith('/fields')
        ? mockJsonResponse(restFieldsResponse)
        : mockJsonResponse(restProjectResponse),
    );
  });

  it('should read the project over REST and issue no GraphQL query when the location is already recorded', async () => {
    const projectCache = buildProjectCache();
    projectCache.stored.set(`projectLocation-${projectId}`, {
      owner: 'HiromiShikata',
      ownerType: 'users',
      projectNumber: 48,
    });
    const repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
      projectCache,
    );

    const project = await repository.getProject(projectId);

    expect(mockPostGithubGraphqlJson).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.github.com/users/HiromiShikata/projectsV2/48',
      expect.anything(),
    );
    expect(project?.id).toEqual(projectId);
    expect(project?.status.statuses).toEqual([
      { id: 'f75ad846', name: 'Unread', color: 'ORANGE', description: '' },
    ]);
  });

  it('should record the location from the project url on the cold start read so the next read goes over REST', async () => {
    const projectCache = buildProjectCache();
    mockPostGithubGraphqlJson.mockResolvedValue(graphqlProjectResponse);
    const repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
      projectCache,
    );

    await repository.getProject(projectId);

    expect(mockPostGithubGraphqlJson).toHaveBeenCalledTimes(1);
    expect(projectCache.stored.get(`projectLocation-${projectId}`)).toEqual({
      owner: 'HiromiShikata',
      ownerType: 'users',
      projectNumber: 48,
    });

    const second = await repository.getProject(projectId);

    expect(mockPostGithubGraphqlJson).toHaveBeenCalledTimes(1);
    expect(second?.id).toEqual(projectId);
  });

  it('should list the field names over REST from the project url without any GraphQL query', async () => {
    const repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
    );

    const names = await repository.listFieldNames({
      id: projectId,
      url: projectUrl,
      databaseId: 1403371,
      name: 'UMINO',
      status: { name: 'Status', fieldId: 'PVTSSF_status', statuses: [] },
      nextActionDate: null,
      nextActionHour: null,
      story: null,
      remainingEstimationMinutes: null,
      dependedIssueUrlSeparatedByComma: null,
      completionDate50PercentConfidence: null,
    });

    expect(mockPostGithubGraphqlJson).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.github.com/users/HiromiShikata/projectsV2/48/fields',
      {
        searchParams: { per_page: 100 },
        headers: {
          Authorization: 'token dummy-token',
          Accept: 'application/vnd.github+json',
        },
      },
    );
    expect(names).toEqual(['Status']);
  });

  it('should warn and fall back to the GraphQL project query when the location cache read throws', async () => {
    const projectCache = buildProjectCache();
    projectCache.getLatest.mockRejectedValue(new Error('corrupted file'));
    mockPostGithubGraphqlJson.mockResolvedValue(graphqlProjectResponse);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
      projectCache,
    );

    const project = await repository.getProject(projectId);

    expect(project?.id).toEqual(projectId);
    expect(mockPostGithubGraphqlJson).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'reading the project location disk cache failed, falling back to the GraphQL project query',
      ),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('corrupted file'),
    );
    warn.mockRestore();
  });

  it('should warn and still return the project when the location cache write throws', async () => {
    const projectCache = buildProjectCache();
    projectCache.set.mockRejectedValue(new Error('disk full'));
    mockPostGithubGraphqlJson.mockResolvedValue(graphqlProjectResponse);
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const repository = new GraphqlProjectRepository(
      localStorageRepository,
      'dummy-token',
      projectCache,
    );

    const project = await repository.getProject(projectId);

    expect(project?.id).toEqual(projectId);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'writing the project location disk cache failed, every later process will fall back to the GraphQL project query',
      ),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    warn.mockRestore();
  });
});
