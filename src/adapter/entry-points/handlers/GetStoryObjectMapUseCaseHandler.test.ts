import fs from 'fs';
import YAML from 'yaml';
const mockReadFileSync = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: (...args: Parameters<typeof fs.readFileSync>) =>
    mockReadFileSync(...args),
  default: {
    ...jest.requireActual('fs'),
    readFileSync: (...args: Parameters<typeof fs.readFileSync>) =>
      mockReadFileSync(...args),
  },
}));
jest.mock('gh-cookie', () => ({ getCookieContent: jest.fn() }));
jest.mock('../../repositories/LocalStorageRepository');
jest.mock('../../repositories/GraphqlProjectRepository');
jest.mock('../../repositories/CheerioProjectRepository');
jest.mock('../../repositories/issue/ApiV3IssueRepository');
jest.mock('../../repositories/issue/RestIssueRepository');
jest.mock('../../repositories/issue/GraphqlProjectItemRepository');
jest.mock('../../repositories/issue/ApiV3CheerioRestIssueRepository');
jest.mock('../../repositories/LocalStorageCacheRepository');
jest.mock('../../repositories/BaseGitHubRepository');
jest.mock('../../../domain/usecases/GetStoryObjectMapUseCase', () => ({
  GetStoryObjectMapUseCase: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue({
      project: {},
      issues: [],
      cacheUsed: false,
      storyObjectMap: new Map(),
    }),
  })),
}));
import { GetStoryObjectMapUseCaseHandler } from './GetStoryObjectMapUseCaseHandler';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
const validConfig = {
  projectUrl: 'https://github.com/orgs/test/projects/1',
  projectName: 'test-project',
  urlOfStoryView: 'https://github.com/orgs/test/projects/1/views/1',
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
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(YAML.stringify(validConfig));
  });
  it('should pass bot credentials to repository constructors when provided', async () => {
    const configWithCredentials = {
      ...validConfig,
      credentials: {
        bot: {
          github: {
            token: 'test-token',
            name: 'bot-user',
            password: 'bot-pass',
            authenticatorKey: 'bot-auth-key',
          },
        },
      },
    };
    mockReadFileSync.mockReturnValue(YAML.stringify(configWithCredentials));
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);
    const expectedCookiePath =
      './tmp/cache/test-project/github.com.cookies.json';
    for (const MockedClass of [
      jest.mocked(GraphqlProjectRepository),
      jest.mocked(CheerioProjectRepository),
      jest.mocked(ApiV3IssueRepository),
      jest.mocked(RestIssueRepository),
      jest.mocked(GraphqlProjectItemRepository),
    ]) {
      expect(MockedClass).toHaveBeenCalledWith(
        expect.anything(),
        expectedCookiePath,
        'test-token',
        'bot-user',
        'bot-pass',
        'bot-auth-key',
      );
    }
    expect(jest.mocked(ApiV3CheerioRestIssueRepository)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expectedCookiePath,
      'test-token',
      'bot-user',
      'bot-pass',
      'bot-auth-key',
    );
  });
  it('should pass undefined credentials when bot github name/password/authenticatorKey are not provided', async () => {
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);
    const expectedCookiePath =
      './tmp/cache/test-project/github.com.cookies.json';
    for (const MockedClass of [
      jest.mocked(GraphqlProjectRepository),
      jest.mocked(CheerioProjectRepository),
      jest.mocked(ApiV3IssueRepository),
      jest.mocked(RestIssueRepository),
      jest.mocked(GraphqlProjectItemRepository),
    ]) {
      expect(MockedClass).toHaveBeenCalledWith(
        expect.anything(),
        expectedCookiePath,
        'test-token',
        undefined,
        undefined,
        undefined,
      );
    }
  });
});
