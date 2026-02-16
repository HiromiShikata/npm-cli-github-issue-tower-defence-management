import fs from 'fs';
import YAML from 'yaml';

jest.mock('fs');
jest.mock('gh-cookie', () => ({ getCookieContent: jest.fn() }));
jest.mock('../../repositories/LocalStorageRepository');
jest.mock('../../repositories/GraphqlProjectRepository');
jest.mock('../../repositories/issue/ApiV3IssueRepository');
jest.mock('../../repositories/issue/RestIssueRepository');
jest.mock('../../repositories/issue/GraphqlProjectItemRepository');
jest.mock('../../repositories/issue/ApiV3CheerioRestIssueRepository');
jest.mock('../../repositories/LocalStorageCacheRepository');
jest.mock('../../repositories/BaseGitHubRepository');
jest.mock('../../repositories/CheerioProjectRepository');

const mockRun = jest.fn().mockResolvedValue({
  project: {},
  issues: [],
  cacheUsed: false,
  storyObjectMap: new Map(),
});

jest.mock('../../../domain/usecases/GetStoryObjectMapUseCase', () => ({
  GetStoryObjectMapUseCase: jest.fn().mockImplementation(() => ({
    run: mockRun,
  })),
}));

import { GetStoryObjectMapUseCaseHandler } from './GetStoryObjectMapUseCaseHandler';

const validConfig = {
  projectUrl: 'https://github.com/orgs/test/projects/1',
  projectName: 'test-project',
  allowIssueCacheMinutes: 60,
  credentials: {
    bot: {
      github: {
        token: 'test-token',
      },
    },
  },
};

describe('GetStoryObjectMapUseCaseHandler', () => {
  beforeEach(() => {
    mockRun.mockClear();
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));
  });

  it('should pass config allowIssueCacheMinutes when allowCacheMinutes is not provided', async () => {
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        allowIssueCacheMinutes: 60,
      }),
    );
  });

  it('should override allowIssueCacheMinutes when allowCacheMinutes is provided', async () => {
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false, 120);

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        allowIssueCacheMinutes: 120,
      }),
    );
  });

  it('should use config value when allowCacheMinutes is undefined', async () => {
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false, undefined);

    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        allowIssueCacheMinutes: 60,
      }),
    );
  });
});
