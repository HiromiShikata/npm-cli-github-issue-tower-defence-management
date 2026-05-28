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

import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

const mockJsonResponse = <T>(data: T) => ({
  json: jest.fn().mockResolvedValue(data),
});

const searchItems = [
  {
    html_url: 'https://github.com/HiromiShikata/test-repository/issues/38',
    title: 'In progress test title',
    number: 38,
  },
];

describe('ApiV3IssueRepository', () => {
  const localStorageRepository = new LocalStorageRepository();
  const repository = new ApiV3IssueRepository(
    localStorageRepository,
    'dummy-token',
  );

  afterEach(() => {
    mockGet.mockReset();
  });

  test('searchIssue', async () => {
    mockGet.mockReturnValue(mockJsonResponse({ items: searchItems }));

    const result = await repository.searchIssue({
      owner: 'HiromiShikata',
      repositoryName: 'test-repository',
      type: 'issue',
      state: 'open',
      title: 'In progress',
      createdFrom: '2024-04-21',
      assignee: 'HiromiShikata',
    });

    expect(result).toEqual([
      {
        number: 38,
        title: 'In progress test title',
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
      },
    ]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      "https://api.github.com/search/issues?q=repo:HiromiShikata/test-repository+type:issue+state:open+in:title+'In progress'+created:>=2024-04-21&assignee=HiromiShikata",
      {
        headers: {
          Authorization: 'token dummy-token',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
  });

  test('searchIssueByQuery', async () => {
    mockGet.mockReturnValue(mockJsonResponse({ items: searchItems }));

    const result = await repository.searchIssueByQuery(
      'repo:HiromiShikata/test-repository type:issue state:open in:title+In progress created:>=2024-04-21 assignee:HiromiShikata',
    );

    expect(result).toEqual([
      {
        number: 38,
        title: 'In progress test title',
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
      },
    ]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      'https://api.github.com/search/issues?q=repo:HiromiShikata/test-repository type:issue state:open in:title+In progress created:>=2024-04-21 assignee:HiromiShikata',
      {
        headers: {
          Authorization: 'token dummy-token',
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
  });
});
