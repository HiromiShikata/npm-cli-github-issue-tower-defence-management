import fs from 'fs';
import YAML from 'yaml';
import axios from 'axios';

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
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';

const MockedGraphqlProjectRepository = jest.mocked(GraphqlProjectRepository);
const MockedCheerioProjectRepository = jest.mocked(CheerioProjectRepository);
const MockedApiV3IssueRepository = jest.mocked(ApiV3IssueRepository);
const MockedRestIssueRepository = jest.mocked(RestIssueRepository);
const MockedGraphqlProjectItemRepository = jest.mocked(
  GraphqlProjectItemRepository,
);
const MockedApiV3CheerioRestIssueRepository = jest.mocked(
  ApiV3CheerioRestIssueRepository,
);

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
    jest.clearAllMocks();
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
    jest
      .mocked(fs.readFileSync)
      .mockReturnValue(YAML.stringify(configWithCredentials));

    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCookiePath = `./tmp/cache/${validConfig.projectName}/github.com.cookies.json`;

    for (const MockedClass of [
      MockedGraphqlProjectRepository,
      MockedCheerioProjectRepository,
      MockedApiV3IssueRepository,
      MockedRestIssueRepository,
      MockedGraphqlProjectItemRepository,
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

    expect(MockedApiV3CheerioRestIssueRepository).toHaveBeenCalledWith(
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

  it('should pass undefined credentials when not provided in config', async () => {
    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCookiePath = `./tmp/cache/${validConfig.projectName}/github.com.cookies.json`;

    for (const MockedClass of [
      MockedGraphqlProjectRepository,
      MockedCheerioProjectRepository,
      MockedApiV3IssueRepository,
      MockedRestIssueRepository,
      MockedGraphqlProjectItemRepository,
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

  it('should redact Authorization and cookie headers in verbose mode error', async () => {
    expect.assertions(4);
    const capturedHandlers: Array<(error: unknown) => unknown> = [];
    jest
      .spyOn(axios.interceptors.response, 'use')
      .mockImplementationOnce((_, errorHandler) => {
        if (errorHandler) {
          capturedHandlers.push(errorHandler);
        }
        return 0;
      });

    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', true);

    expect(capturedHandlers).toHaveLength(1);

    const mockAxiosError = {
      message: 'Request failed with status code 401',
      code: 'ERR_BAD_RESPONSE',
      config: {
        url: 'https://api.github.com/graphql',
        method: 'post',
        headers: {
          toJSON: () => ({
            Authorization: 'Bearer secret-github-token',
            cookie: 'session=secret-cookie-value',
            'Content-Type': 'application/json',
          }),
        },
      },
      response: { status: 401 },
    };

    try {
      capturedHandlers[0](mockAxiosError);
    } catch (thrownError) {
      if (!(thrownError instanceof Error)) {
        return;
      }
      expect(thrownError.message).not.toContain('secret-github-token');
      expect(thrownError.message).not.toContain('secret-cookie-value');
      expect(thrownError.message).toContain('[REDACTED]');
    }
  });

  it('should not expose Authorization header in non-verbose mode error', async () => {
    expect.assertions(2);
    const capturedHandlers: Array<(error: unknown) => unknown> = [];
    jest
      .spyOn(axios.interceptors.response, 'use')
      .mockImplementationOnce((_, errorHandler) => {
        if (errorHandler) {
          capturedHandlers.push(errorHandler);
        }
        return 0;
      });

    const handler = new GetStoryObjectMapUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(capturedHandlers).toHaveLength(1);

    const mockAxiosError = {
      response: { status: 403 },
    };

    try {
      capturedHandlers[0](mockAxiosError);
    } catch (thrownError) {
      if (!(thrownError instanceof Error)) {
        return;
      }
      expect(thrownError.message).toBe('API Error: 403');
    }
  });
});
