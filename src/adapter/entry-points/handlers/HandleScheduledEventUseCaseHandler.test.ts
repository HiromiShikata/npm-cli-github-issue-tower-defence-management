import fs from 'fs';
import YAML from 'yaml';
import type { HandleScheduledEventUseCase } from '../../../domain/usecases/HandleScheduledEventUseCase';

jest.mock('fs');
jest.mock('../../repositories/SystemDateRepository');
jest.mock('../../repositories/LocalStorageRepository');
jest.mock('../../repositories/GoogleSpreadsheetRepository');
jest.mock('../../repositories/GraphqlProjectRepository');
jest.mock('../../repositories/issue/ApiV3IssueRepository');
jest.mock('../../repositories/issue/RestIssueRepository');
jest.mock('../../repositories/issue/GraphqlProjectItemRepository');
jest.mock('../../repositories/issue/ApiV3CheerioRestIssueRepository');
jest.mock('../../repositories/LocalStorageCacheRepository');
jest.mock('../../repositories/BaseGitHubRepository');

type RunFn = HandleScheduledEventUseCase['run'];
const capturedRunInputs: Parameters<RunFn>[] = [];
const mockRun = jest.fn().mockImplementation((...args: Parameters<RunFn>) => {
  capturedRunInputs.push(args);
  return Promise.resolve({
    project: { id: 'PVT_kwHOtest123' },
    issues: [],
    cacheUsed: false,
    targetDateTimes: [],
  });
});

jest.mock('../../../domain/usecases/HandleScheduledEventUseCase', () => ({
  HandleScheduledEventUseCase: jest.fn().mockImplementation(() => ({
    run: mockRun,
  })),
}));
jest.mock('../../../domain/usecases/ActionAnnouncementUseCase', () => ({
  ActionAnnouncementUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase',
  () => ({
    SetWorkflowManagementIssueToStoryUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock(
  '../../../domain/usecases/ClearPastNextActionDateHourUseCase',
  () => ({
    ClearPastNextActionDateHourUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock('../../../domain/usecases/AnalyzeProblemByIssueUseCase', () => ({
  AnalyzeProblemByIssueUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/AnalyzeStoriesUseCase', () => ({
  AnalyzeStoriesUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/ClearDependedIssueURLUseCase', () => ({
  ClearDependedIssueURLUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/CreateEstimationIssueUseCase', () => ({
  CreateEstimationIssueUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase',
  () => ({
    ConvertCheckboxToIssueInStoryIssueUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock('../../../domain/usecases/ChangeStatusByStoryColorUseCase', () => ({
  ChangeStatusByStoryColorUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/SetNoStoryIssueToStoryUseCase', () => ({
  SetNoStoryIssueToStoryUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/CreateNewStoryByLabelUseCase', () => ({
  CreateNewStoryByLabelUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase',
  () => ({
    AssignNoAssigneeIssueToManagerUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock('../../../domain/usecases/UpdateIssueStatusByLabelUseCase', () => ({
  UpdateIssueStatusByLabelUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/StartPreparationUseCase', () => ({
  StartPreparationUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/NodeLocalCommandRunner', () => ({
  NodeLocalCommandRunner: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/OauthAPIProxyClaudeRepository', () => ({
  OauthAPIProxyClaudeRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase',
  () => ({
    NotifyFinishedIssuePreparationUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock('../../repositories/GitHubIssueCommentRepository', () => ({
  GitHubIssueCommentRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/FetchWebhookRepository', () => ({
  FetchWebhookRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('./situationFileWriter', () => ({
  writeSituationFile: jest.fn().mockResolvedValue(undefined),
}));

import { HandleScheduledEventUseCaseHandler } from './HandleScheduledEventUseCaseHandler';
import { writeSituationFile } from './situationFileWriter';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';

const MockedGraphqlProjectRepository = jest.mocked(GraphqlProjectRepository);
const MockedApiV3IssueRepository = jest.mocked(ApiV3IssueRepository);
const MockedRestIssueRepository = jest.mocked(RestIssueRepository);
const MockedGraphqlProjectItemRepository = jest.mocked(
  GraphqlProjectItemRepository,
);
const MockedApiV3CheerioRestIssueRepository = jest.mocked(
  ApiV3CheerioRestIssueRepository,
);

const validConfig = {
  projectName: 'test-project',
  org: 'TestOrg',
  projectUrl: 'https://github.com/users/TestOrg/projects/1',
  manager: 'TestManager',
  urlOfStoryView: 'https://github.com/users/TestOrg/projects/1/views/1',
  disabled: false,
  allowIssueCacheMinutes: 1,
  workingReport: {
    repo: 'test-repo',
    members: ['TestManager'],
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test/edit',
  },
  credentials: {
    manager: {
      github: { token: 'ghp_manager_token' },
      slack: { userToken: 'xoxp-slack-token' },
      googleServiceAccount: { serviceAccountKey: '{}' },
    },
    bot: {
      github: {
        token: 'test-token',
      },
    },
  },
};

const mockFetchReturningReadme = (readme: string | null): void => {
  const responseBody =
    readme === null
      ? { data: {} }
      : { data: { organization: { projectV2: { readme } } } };
  jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

describe('HandleScheduledEventUseCaseHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedRunInputs.length = 0;
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));
    mockFetchReturningReadme(null);
  });

  it('should pass bot credentials to repository constructors when provided', async () => {
    const configWithCredentials = {
      ...validConfig,
      credentials: {
        ...validConfig.credentials,
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

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCookiePath = `./tmp/cache/${validConfig.projectName}/github.com.cookies.json`;

    for (const MockedClass of [
      MockedGraphqlProjectRepository,
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
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCookiePath = `./tmp/cache/${validConfig.projectName}/github.com.cookies.json`;

    for (const MockedClass of [
      MockedGraphqlProjectRepository,
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

  it('should write situation file after successful run with resolved config values', async () => {
    const configWithPreparation = {
      ...validConfig,
      allowIssueCacheMinutes: 5,
      startPreparation: {
        defaultAgentName: 'agent1',
        configFilePath: './config.yml',
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 97,
      },
      notifyFinishedPreparation: {
        thresholdForAutoReject: 30,
        workflowBlockerResolvedWebhookUrl: null,
      },
    };
    jest
      .mocked(fs.readFileSync)
      .mockReturnValue(YAML.stringify(configWithPreparation));

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCachePath = `./tmp/cache/${validConfig.projectName}`;
    const firstCallArg = jest.mocked(writeSituationFile).mock.calls[0][0];
    expect(firstCallArg.cachePath).toBe(expectedCachePath);
    expect(firstCallArg.projectId).toBe('PVT_kwHOtest123');
    expect(firstCallArg.config.maximumPreparingIssuesCount).toBe(10);
    expect(firstCallArg.config.utilizationPercentageThreshold).toBe(97);
    expect(firstCallArg.config.allowIssueCacheMinutes).toBe(5);
    expect(firstCallArg.config.thresholdForAutoReject).toBe(30);
    expect(firstCallArg.statusNames.awaitingQualityCheckStatus).toBe(
      'Awaiting QC',
    );
    expect(firstCallArg.statusNames.preparationStatus).toBe('Preparing');
    expect(firstCallArg.statusNames.awaitingWorkspaceStatus).toBe('Awaiting');
  });

  it('should write situation file with numeric defaults when optional fields are absent', async () => {
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const firstCallArg = jest.mocked(writeSituationFile).mock.calls[0][0];
    expect(firstCallArg.config.utilizationPercentageThreshold).toBe(90);
    expect(firstCallArg.config.thresholdForAutoReject).toBe(3);
    expect(firstCallArg.config.maximumPreparingIssuesCount).toBeNull();
  });

  it('should not write situation file when run returns null', async () => {
    mockRun.mockResolvedValueOnce(null);
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(jest.mocked(writeSituationFile)).not.toHaveBeenCalled();
  });

  describe('README config overrides', () => {
    const configWithStartPreparation = {
      ...validConfig,
      allowIssueCacheMinutes: 5,
      startPreparation: {
        defaultAgentName: 'yaml-agent',
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 90,
      },
    };

    it('should override startPreparation fields from README config', async () => {
      const readmeContent = `<details>
<summary>config</summary>
maximumPreparingIssuesCount: 0
defaultAgentName: readme-agent
utilizationPercentageThreshold: 80
</details>`;
      mockFetchReturningReadme(readmeContent);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithStartPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        startPreparation: {
          maximumPreparingIssuesCount: 0,
          defaultAgentName: 'readme-agent',
          utilizationPercentageThreshold: 80,
        },
      });
    });

    it('should override allowIssueCacheMinutes from README config', async () => {
      const readmeContent = `<details>
<summary>config</summary>
allowIssueCacheMinutes: 30
</details>`;
      mockFetchReturningReadme(readmeContent);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithStartPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          allowIssueCacheMinutes: 30,
        }),
      );
    });

    it('should split comma-separated allowedIssueAuthors from README config', async () => {
      const readmeContent = `<details>
<summary>config</summary>
allowedIssueAuthors: 'user1, user2, user3'
</details>`;
      mockFetchReturningReadme(readmeContent);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithStartPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        startPreparation: {
          allowedIssueAuthors: ['user1', 'user2', 'user3'],
        },
      });
    });

    it('should keep YAML values when README has no config section', async () => {
      mockFetchReturningReadme(null);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithStartPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        allowIssueCacheMinutes: 5,
        startPreparation: {
          maximumPreparingIssuesCount: 10,
          defaultAgentName: 'yaml-agent',
        },
      });
    });

    it('should use README token from manager credentials to fetch README', async () => {
      mockFetchReturningReadme(null);
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/graphql',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(capturedRunInputs[0][0]).toMatchObject({
        projectUrl: validConfig.projectUrl,
      });
    });
  });
});
