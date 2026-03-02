import fs from 'fs';
import YAML from 'yaml';

jest.mock('fs');
jest.mock('gh-cookie', () => ({ getCookieContent: jest.fn() }));
jest.mock('../../repositories/SystemDateRepository');
jest.mock('../../repositories/LocalStorageRepository');
jest.mock('../../repositories/GoogleSpreadsheetRepository');
jest.mock('../../repositories/GraphqlProjectRepository');
jest.mock('../../repositories/CheerioProjectRepository');
jest.mock('../../repositories/issue/ApiV3IssueRepository');
jest.mock('../../repositories/issue/RestIssueRepository');
jest.mock('../../repositories/issue/GraphqlProjectItemRepository');
jest.mock('../../repositories/issue/ApiV3CheerioRestIssueRepository');
jest.mock('../../repositories/LocalStorageCacheRepository');
jest.mock('../../repositories/BaseGitHubRepository');

const mockRun = jest.fn().mockResolvedValue({
  project: {},
  issues: [],
  cacheUsed: false,
  targetDateTimes: [],
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
jest.mock('../../../domain/usecases/ClearNextActionHourUseCase', () => ({
  ClearNextActionHourUseCase: jest.fn().mockImplementation(() => ({})),
}));
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

import { HandleScheduledEventUseCaseHandler } from './HandleScheduledEventUseCaseHandler';
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
  projectName: 'test-project',
  org: 'TestOrg',
  projectUrl: 'https://github.com/users/TestOrg/projects/1',
  manager: 'TestManager',
  urlOfStoryView: 'https://github.com/users/TestOrg/projects/1/views/1',
  disabledStatus: 'Icebox',
  defaultStatus: 'Unread',
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

describe('HandleScheduledEventUseCaseHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));
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
    const handler = new HandleScheduledEventUseCaseHandler();
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
});
