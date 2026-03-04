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
jest.mock('../../../domain/usecases/HandleScheduledEventUseCase', () => ({
  HandleScheduledEventUseCase: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue({
      project: {},
      issues: [],
      cacheUsed: false,
      targetDateTimes: [],
      storyIssues: new Map(),
    }),
  })),
}));
jest.mock('../../../domain/usecases/ActionAnnouncementUseCase');
jest.mock('../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase');
jest.mock('../../../domain/usecases/ClearNextActionHourUseCase');
jest.mock('../../../domain/usecases/AnalyzeProblemByIssueUseCase');
jest.mock('../../../domain/usecases/AnalyzeStoriesUseCase');
jest.mock('../../../domain/usecases/ClearDependedIssueURLUseCase');
jest.mock('../../../domain/usecases/CreateEstimationIssueUseCase');
jest.mock('../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase');
jest.mock('../../../domain/usecases/ChangeStatusByStoryColorUseCase');
jest.mock('../../../domain/usecases/SetNoStoryIssueToStoryUseCase');
jest.mock('../../../domain/usecases/CreateNewStoryByLabelUseCase');
jest.mock('../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase');
jest.mock('../../../domain/usecases/UpdateIssueStatusByLabelUseCase');
import { HandleScheduledEventUseCaseHandler } from './HandleScheduledEventUseCaseHandler';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
const validConfig = {
  projectName: 'test-project',
  org: 'test-org',
  projectUrl: 'https://github.com/orgs/test/projects/1',
  manager: 'test-manager',
  urlOfStoryView: 'https://github.com/orgs/test/projects/1/views/1',
  disabledStatus: 'Disabled',
  defaultStatus: 'Todo',
  queryToAddProject: '',
  allowIssueCacheMinutes: 60,
  workingReport: {
    repo: 'test-repo',
    members: ['member1'],
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test/edit',
  },
  credentials: {
    manager: {
      github: { token: 'manager-token' },
      slack: { userToken: 'slack-token' },
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
    mockReadFileSync.mockReturnValue(YAML.stringify(validConfig));
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
    mockReadFileSync.mockReturnValue(YAML.stringify(configWithCredentials));
    const handler = new HandleScheduledEventUseCaseHandler();
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
    const handler = new HandleScheduledEventUseCaseHandler();
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
