const mockGet = jest.fn();

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

import {
  RestProjectRepository,
  projectLocationFromUrl,
  projectUrlFromLocation,
} from './RestProjectRepository';
import { LocalStorageRepository } from './LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const projectResponse = {
  id: 1403371,
  node_id: 'PVT_kwHOAGJHa84AFWnr',
  title: 'UMINO',
};

const fieldsResponse = [
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
      {
        id: 'e9931e57',
        name: { html: 'Todo by human', raw: 'Todo by human' },
        description: { html: 'own queue', raw: 'own queue' },
        color: 'PINK',
      },
    ],
  },
  {
    id: 133939017,
    node_id: 'PVTSSF_story',
    name: 'story',
    options: [
      {
        id: '6dc26727',
        name: {
          html: 'regular / workflow management',
          raw: 'regular / workflow management',
        },
        description: { html: '', raw: '' },
        color: 'BLUE',
      },
    ],
  },
  {
    id: 35978365,
    node_id: 'PVTF_nextactiondate',
    name: 'nextactiondate',
  },
];

describe('RestProjectRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const repository = new RestProjectRepository(
    localStorageRepository,
    'dummy-token',
  );
  const location = {
    owner: 'HiromiShikata',
    ownerType: 'users' as const,
    projectNumber: 48,
  };

  afterEach(() => {
    mockGet.mockReset();
  });

  describe('listFieldDefinitions', () => {
    it('should read the fields from the projects REST endpoint and convert the option colors', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse(fieldsResponse));

      const fields = await repository.listFieldDefinitions(location);

      expect(mockGet).toHaveBeenCalledTimes(1);
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
      expect(fields).toEqual([
        {
          fieldId: 'PVTSSF_status',
          databaseId: 12940049,
          name: 'Status',
          options: [
            {
              id: 'f75ad846',
              name: 'Unread',
              color: 'ORANGE',
              description: '',
            },
            {
              id: 'e9931e57',
              name: 'Todo by human',
              color: 'PINK',
              description: 'own queue',
            },
          ],
        },
        {
          fieldId: 'PVTSSF_story',
          databaseId: 133939017,
          name: 'story',
          options: [
            {
              id: '6dc26727',
              name: 'regular / workflow management',
              color: 'BLUE',
              description: '',
            },
          ],
        },
        {
          fieldId: 'PVTF_nextactiondate',
          databaseId: 35978365,
          name: 'nextactiondate',
          options: [],
        },
      ]);
    });

    it('should address the organization route for an organization owned project', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse([]));

      await repository.listFieldDefinitions({
        owner: 'X-Mile',
        ownerType: 'orgs',
        projectNumber: 7,
      });

      expect(mockGet).toHaveBeenCalledWith(
        'https://api.github.com/orgs/X-Mile/projectsV2/7/fields',
        expect.anything(),
      );
    });
  });

  describe('listFieldNames', () => {
    it('should return every field name including the ones the project entity does not keep', async () => {
      mockGet.mockReturnValueOnce(mockJsonResponse(fieldsResponse));

      const names = await repository.listFieldNames(location);

      expect(names).toEqual(['Status', 'story', 'nextactiondate']);
    });
  });

  describe('getProject', () => {
    it('should build the project from the REST project and field responses', async () => {
      mockGet.mockImplementation((url: string) =>
        url.endsWith('/fields')
          ? mockJsonResponse(fieldsResponse)
          : mockJsonResponse(projectResponse),
      );

      const project = await repository.getProject(location);

      expect(project.id).toEqual('PVT_kwHOAGJHa84AFWnr');
      expect(project.databaseId).toEqual(1403371);
      expect(project.name).toEqual('UMINO');
      expect(project.url).toEqual(
        'https://github.com/users/HiromiShikata/projects/48',
      );
      expect(project.status.fieldId).toEqual('PVTSSF_status');
      expect(project.status.statuses.map((status) => status.name)).toEqual([
        'Unread',
        'Todo by human',
      ]);
      expect(project.story?.workflowManagementStory).toEqual({
        id: '6dc26727',
        name: 'regular / workflow management',
        color: 'BLUE',
        description: '',
      });
      expect(project.nextActionDate).toEqual({
        name: 'nextactiondate',
        fieldId: 'PVTF_nextactiondate',
      });
    });
  });
});

describe('projectLocationFromUrl', () => {
  it('should read the owner and the number from a user owned project url', () => {
    expect(
      projectLocationFromUrl(
        'https://github.com/users/HiromiShikata/projects/48',
      ),
    ).toEqual({
      owner: 'HiromiShikata',
      ownerType: 'users',
      projectNumber: 48,
    });
  });

  it('should read the owner and the number from an organization owned project url', () => {
    expect(
      projectLocationFromUrl('https://github.com/orgs/X-Mile/projects/7'),
    ).toEqual({
      owner: 'X-Mile',
      ownerType: 'orgs',
      projectNumber: 7,
    });
  });

  it('should return null for a url that is not a project url', () => {
    expect(
      projectLocationFromUrl(
        'https://github.com/HiromiShikata/secretary/issues/1',
      ),
    ).toBeNull();
  });
});

describe('projectUrlFromLocation', () => {
  it('should rebuild the project url the GraphQL API returns', () => {
    expect(
      projectUrlFromLocation({
        owner: 'HiromiShikata',
        ownerType: 'users',
        projectNumber: 48,
      }),
    ).toEqual('https://github.com/users/HiromiShikata/projects/48');
  });
});
