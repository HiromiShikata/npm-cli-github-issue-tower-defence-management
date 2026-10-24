import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';
import { mock } from 'jest-mock-extended';
import { projectCacheDirectory } from '../../repositories/localStorageCacheDirectory';
import type { FieldOption, Project } from '../../../domain/entities/Project';
import type { Issue } from '../../../domain/entities/Issue';
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
jest.mock('../../repositories/FileSystemAgentDefinitionRepository', () => ({
  ...jest.requireActual<
    typeof import('../../repositories/FileSystemAgentDefinitionRepository')
  >('../../repositories/FileSystemAgentDefinitionRepository'),
  FileSystemAgentDefinitionRepository: jest.fn(),
}));

type RunFn = HandleScheduledEventUseCase['run'];
const capturedRunInputs: Parameters<RunFn>[] = [];
const mockRun = jest
  .fn()
  .mockImplementation(async (...args: Parameters<RunFn>) => {
    capturedRunInputs.push(args);
    const input = args[0];
    const mockProject = mock<Project>({ id: 'PVT_kwHOtest123' });
    const mockIssues: Issue[] = [];
    if (input.afterIssuesFetched) {
      await input.afterIssuesFetched(mockProject, mockIssues);
    }
    return {
      project: mockProject,
      issues: mockIssues,
      cacheUsed: false,
      targetDateTimes: [],
      rotationOrder: null,
    };
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
jest.mock('../../../domain/usecases/ClearDependedIssueURLUseCase', () => ({
  ClearDependedIssueURLUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock(
  '../../../domain/usecases/SetDependedIssueUrlForOpenTaskPRsUseCase',
  () => ({
    SetDependedIssueUrlForOpenTaskPRsUseCase: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);
jest.mock('../../../domain/usecases/CreateEstimationIssueUseCase', () => ({
  CreateEstimationIssueUseCase: jest.fn().mockImplementation(() => ({})),
}));
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
jest.mock('../../repositories/ProxyClaudeTokenUsageRepository', () => ({
  ProxyClaudeTokenUsageRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/ProxyRateLimitCacheRepository', () => ({
  ProxyRateLimitCacheRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../domain/usecases/UpdateRateLimitCacheUseCase', () => ({
  UpdateRateLimitCacheUseCase: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/GitHubIssueCommentRepository', () => ({
  GitHubIssueCommentRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('./situationFileWriter', () => ({
  writeSituationFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./rotationOrderFileWriter', () => ({
  writeRotationOrderFile: jest.fn(),
}));
jest.mock('./inTmuxByHumanDataWriter', () => ({
  writeInTmuxByHumanData: jest.fn(),
}));
jest.mock('./ownerCallFileCleaner', () => ({
  cleanClosedIssueOwnerCallFiles: jest.fn(),
}));
jest.mock('./consoleListsWriter', () => {
  const actual = jest.requireActual<typeof import('./consoleListsWriter')>(
    './consoleListsWriter',
  );
  return { ...actual, writeConsoleLists: jest.fn() };
});
jest.mock('../cli/fleetConfig', () => ({
  resolveFleetConfigFilePath: jest.fn(),
  loadStartPreparationFleetSettings: jest.fn(),
  loadWorkflowImprovementIssueUrl: jest.fn(),
  loadWorkflowIssueReporterSettings: jest.fn(),
  loadSilentNotificationEnabled: jest.fn(),
}));
jest.mock('./notifySilentTmuxSessions', () => ({
  notifySilentTmuxSessions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./inTmuxByHumanSessionReconciler', () => ({
  reconcileInTmuxByHumanSessions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./staleTmuxSessionCleaner', () => ({
  cleanStaleTmuxSessions: jest.fn().mockResolvedValue(undefined),
}));

import { reconcileInTmuxByHumanSessions } from './inTmuxByHumanSessionReconciler';
import { cleanStaleTmuxSessions } from './staleTmuxSessionCleaner';
import { HandleScheduledEventUseCaseHandler } from './HandleScheduledEventUseCaseHandler';
import { writeSituationFile } from './situationFileWriter';
import { writeInTmuxByHumanData } from './inTmuxByHumanDataWriter';
import { cleanClosedIssueOwnerCallFiles } from './ownerCallFileCleaner';
import { writeConsoleLists } from './consoleListsWriter';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { ProxyClaudeTokenUsageRepository } from '../../repositories/ProxyClaudeTokenUsageRepository';
import { GitHubIssueCommentRepository } from '../../repositories/GitHubIssueCommentRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { FileSystemAgentDefinitionRepository } from '../../repositories/FileSystemAgentDefinitionRepository';
import { resetProjectReadmeInMemoryCacheForTesting } from '../cli/projectConfig';
import {
  loadSilentNotificationEnabled,
  loadWorkflowImprovementIssueUrl,
  loadStartPreparationFleetSettings,
  loadWorkflowIssueReporterSettings,
  resolveFleetConfigFilePath,
} from '../cli/fleetConfig';
import { notifySilentTmuxSessions } from './notifySilentTmuxSessions';

const mockLoadSilentNotificationEnabled = jest.mocked(
  loadSilentNotificationEnabled,
);
const mockLoadWorkflowImprovementIssueUrl = jest.mocked(
  loadWorkflowImprovementIssueUrl,
);
const mockLoadStartPreparationFleetSettings = jest.mocked(
  loadStartPreparationFleetSettings,
);
const mockLoadWorkflowIssueReporterSettings = jest.mocked(
  loadWorkflowIssueReporterSettings,
);
const mockResolveFleetConfigFilePath = jest.mocked(resolveFleetConfigFilePath);
const mockNotifySilentTmuxSessions = jest.mocked(notifySilentTmuxSessions);

const MockedGraphqlProjectRepository = jest.mocked(GraphqlProjectRepository);
const MockedApiV3IssueRepository = jest.mocked(ApiV3IssueRepository);
const MockedRestIssueRepository = jest.mocked(RestIssueRepository);
const MockedGraphqlProjectItemRepository = jest.mocked(
  GraphqlProjectItemRepository,
);
const MockedApiV3CheerioRestIssueRepository = jest.mocked(
  ApiV3CheerioRestIssueRepository,
);
const MockedProxyClaudeTokenUsageRepository = jest.mocked(
  ProxyClaudeTokenUsageRepository,
);
const MockedGitHubIssueCommentRepository = jest.mocked(
  GitHubIssueCommentRepository,
);
const MockedWriteInTmuxByHumanData = jest.mocked(writeInTmuxByHumanData);
const mockGetLastIssuesFetchedAt = jest.fn<string | null, [string]>();
ApiV3CheerioRestIssueRepository.prototype.getLastIssuesFetchedAt =
  mockGetLastIssuesFetchedAt;

const mockLocalStorageCacheGetSingle = jest
  .fn<Promise<unknown>, [string]>()
  .mockResolvedValue(null);
const mockLocalStorageCacheSetSingle = jest
  .fn<Promise<void>, [string, unknown]>()
  .mockResolvedValue(undefined);
LocalStorageCacheRepository.prototype.getSingle =
  mockLocalStorageCacheGetSingle;
LocalStorageCacheRepository.prototype.setSingle =
  mockLocalStorageCacheSetSingle;

const validConfig = {
  projectName: 'test-project',
  org: 'TestOrg',
  projectUrl: 'https://github.com/users/TestOrg/projects/1',
  manager: 'TestManager',
  urlOfStoryView: 'https://github.com/users/TestOrg/projects/1/views/1',
  disabled: false,
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
    mockGetLastIssuesFetchedAt.mockReturnValue('2026-08-09T02:00:00.000Z');
    mockLocalStorageCacheGetSingle.mockResolvedValue(null);
    mockLocalStorageCacheSetSingle.mockResolvedValue(undefined);
    resetProjectReadmeInMemoryCacheForTesting();
    mockFetchReturningReadme(null);
    mockResolveFleetConfigFilePath.mockReturnValue(null);
    mockLoadSilentNotificationEnabled.mockReturnValue(null);
    mockLoadStartPreparationFleetSettings.mockReturnValue({
      maximumPreparingIssuesCount: 80,
    });
    mockLoadWorkflowImprovementIssueUrl.mockReturnValue(null);
    mockLoadWorkflowIssueReporterSettings.mockReturnValue(null);
  });

  it('should throw when required credential fields are missing from config', async () => {
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify({}));
    const handler = new HandleScheduledEventUseCaseHandler();
    await expect(handler.handle('config.yml', false)).rejects.toThrow(
      'Invalid input',
    );
  });

  it('should name the missing credential field path without leaking any other credential value when one field is missing', async () => {
    const configWithMissingSlackToken = {
      projectName: 'example-org/example-repo',
      org: 'TestOrg',
      projectUrl: 'https://github.com/orgs/example-org/projects/1',
      manager: 'TestManager',
      urlOfStoryView: 'https://github.com/orgs/example-org/projects/1/views/1',
      disabled: false,
      workingReport: {
        repo: 'test-repo',
        members: ['TestManager'],
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test/edit',
      },
      credentials: {
        manager: {
          github: { token: 'ghp_realisticManagerToken1234567890AB' },
          googleServiceAccount: {
            serviceAccountKey:
              '-----BEGIN PRIVATE KEY-----\nMIIFAKEKEYDATAFORTESTONLY1234567890\n-----END PRIVATE KEY-----\n',
          },
        },
        bot: { github: { token: 'ghp_realisticBotToken0987654321ZY' } },
      },
    };
    jest
      .mocked(fs.readFileSync)
      .mockReturnValue(YAML.stringify(configWithMissingSlackToken));
    const handler = new HandleScheduledEventUseCaseHandler();

    let thrownError: Error | undefined;
    try {
      await handler.handle('config.yml', false);
    } catch (error) {
      thrownError = error instanceof Error ? error : undefined;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain(
      'credentials.manager.slack.userToken',
    );
    expect(thrownError?.message).not.toContain(
      'ghp_realisticManagerToken1234567890AB',
    );
    expect(thrownError?.message).not.toContain(
      'ghp_realisticBotToken0987654321ZY',
    );
    expect(thrownError?.message).not.toContain('BEGIN PRIVATE KEY');
  });

  it.each([
    ['incomplete credentials section', { disabled: true }],
    ['complete credentials section', { ...validConfig, disabled: true }],
  ])(
    'should resolve to null without throwing when disabled is true, regardless of credentials (%s)',
    async (_description, config) => {
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(config));
      const handler = new HandleScheduledEventUseCaseHandler();
      await expect(handler.handle('config.yml', false)).resolves.toBeNull();
    },
  );

  it('should pass bot token to repository constructors', async () => {
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    for (const MockedClass of [
      MockedApiV3IssueRepository,
      MockedRestIssueRepository,
      MockedGraphqlProjectItemRepository,
    ]) {
      expect(MockedClass).toHaveBeenCalledWith(expect.anything(), 'test-token');
    }

    expect(MockedGraphqlProjectRepository).toHaveBeenCalledWith(
      expect.anything(),
      'test-token',
      expect.anything(),
    );

    expect(MockedApiV3CheerioRestIssueRepository).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'test-token',
    );
  });

  it('should write situation file after successful run with resolved config values', async () => {
    const configWithPreparation = {
      ...validConfig,
      startPreparation: {
        defaultAgentName: 'agent1',
        configFilePath: './config.yml',
        maximumPreparingIssuesCount: 10,
        utilizationPercentageThreshold: 97,
      },
    };
    jest
      .mocked(fs.readFileSync)
      .mockReturnValue(YAML.stringify(configWithPreparation));

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const expectedCachePath = projectCacheDirectory(validConfig.projectName);
    const firstCallArg = jest.mocked(writeSituationFile).mock.calls[0][0];
    expect(firstCallArg.cachePath).toBe(expectedCachePath);
    expect(firstCallArg.projectId).toBe('PVT_kwHOtest123');
    expect(firstCallArg.config.maximumPreparingIssuesCount).toBe(10);
    expect(firstCallArg.config.utilizationPercentageThreshold).toBe(97);
    expect(firstCallArg.config.thresholdForAutoReject).toBe(3);
    expect(firstCallArg.statusNames.awaitingOwnerStatus).toBe('Awaiting Owner');
    expect(firstCallArg.statusNames.preparationStatus).toBe('Preparation');
    expect(firstCallArg.statusNames.awaitingWorkspaceStatus).toBe(
      'Awaiting Workspace',
    );
  });

  it('stamps console lists with the GitHub read time the lists were built from', async () => {
    mockGetLastIssuesFetchedAt.mockReturnValue('2026-08-09T02:02:28.649Z');

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(jest.mocked(writeConsoleLists)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(writeConsoleLists).mock.calls[0][0].generatedAt).toBe(
      '2026-08-09T02:02:28Z',
    );
  });

  it('does not write console lists when no GitHub read time was recorded', async () => {
    mockGetLastIssuesFetchedAt.mockReturnValue(null);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(jest.mocked(writeConsoleLists)).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No GitHub read time recorded'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should write situation file with numeric defaults when optional fields are absent', async () => {
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    const firstCallArg = jest.mocked(writeSituationFile).mock.calls[0][0];
    expect(firstCallArg.config.utilizationPercentageThreshold).toBe(90);
    expect(firstCallArg.config.thresholdForAutoReject).toBe(3);
    expect(firstCallArg.config.maximumPreparingIssuesCount).toBeNull();
  });

  it('should construct FileSystemAgentDefinitionRepository with the default agent definitions directory path when agentDefinitionsDirectoryPath is not configured', async () => {
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(
      jest.mocked(FileSystemAgentDefinitionRepository).mock.calls[0][0],
    ).toBe(path.join(os.homedir(), '.claude', 'agents'));
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
        startPreparation: {
          maximumPreparingIssuesCount: 10,
          defaultAgentName: 'yaml-agent',
        },
      });
    });

    it('applies the fleet default maximumPreparingIssuesCount when neither README nor YAML provides it', async () => {
      const configWithPreparationNoMax = {
        ...validConfig,
        startPreparation: {
          defaultAgentName: 'yaml-agent',
          configFilePath: '/path/to/config.yml',
          utilizationPercentageThreshold: 90,
        },
      };
      mockFetchReturningReadme(null);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithPreparationNoMax));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        startPreparation: {
          maximumPreparingIssuesCount: 80,
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

    it('should accept a top-level allowedIssueAuthors from the YAML config and pass it through', async () => {
      mockFetchReturningReadme(null);
      const configWithTopLevelAllowedIssueAuthors = {
        ...validConfig,
        allowedIssueAuthors: ['owner', 'dependabot[bot]'],
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithTopLevelAllowedIssueAuthors));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        allowedIssueAuthors: ['owner', 'dependabot[bot]'],
      });
    });

    it('should split a comma-separated top-level allowedIssueAuthors string from the YAML config', async () => {
      mockFetchReturningReadme(null);
      const configWithCommaSeparatedAuthors = {
        ...validConfig,
        allowedIssueAuthors: 'owner, acme-bot ,dependabot[bot]',
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithCommaSeparatedAuthors));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        allowedIssueAuthors: ['owner', 'acme-bot', 'dependabot[bot]'],
      });
    });

    it('should accept a top-level autoAssignManagerAuthors array from the YAML config and pass it through', async () => {
      mockFetchReturningReadme(null);
      const configWithAutoAssignManagerAuthors = {
        ...validConfig,
        autoAssignManagerAuthors: ['renovate[bot]', 'dependabot[bot]'],
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithAutoAssignManagerAuthors));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: ['renovate[bot]', 'dependabot[bot]'],
      });
    });

    it('should split a comma-separated top-level autoAssignManagerAuthors string from the YAML config', async () => {
      mockFetchReturningReadme(null);
      const configWithCommaSeparatedManagerAuthors = {
        ...validConfig,
        autoAssignManagerAuthors: 'renovate[bot], dependabot[bot]',
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(
          YAML.stringify(configWithCommaSeparatedManagerAuthors),
        );

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: ['renovate[bot]', 'dependabot[bot]'],
      });
    });

    it('should default autoAssignManagerAuthors to null when omitted from the YAML config and allowedIssueAuthors is also absent', async () => {
      mockFetchReturningReadme(null);
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: null,
      });
    });

    it('should fall back to allowedIssueAuthors for autoAssignManagerAuthors when autoAssignManagerAuthors is omitted', async () => {
      mockFetchReturningReadme(null);
      const configWithAllowedIssueAuthors = {
        ...validConfig,
        allowedIssueAuthors: ['HiromiShikata', 'umino-bot'],
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithAllowedIssueAuthors));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: ['HiromiShikata', 'umino-bot'],
      });
    });

    it('should prefer explicit autoAssignManagerAuthors over allowedIssueAuthors fallback', async () => {
      mockFetchReturningReadme(null);
      const configWithBothAuthors = {
        ...validConfig,
        allowedIssueAuthors: ['HiromiShikata', 'umino-bot'],
        autoAssignManagerAuthors: ['trusted-bot'],
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithBothAuthors));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: ['trusted-bot'],
      });
    });

    it('should split comma-separated autoAssignManagerAuthors from README config', async () => {
      const readmeContent = `<details>
<summary>config</summary>
autoAssignManagerAuthors: 'renovate[bot], dependabot[bot]'
</details>`;
      mockFetchReturningReadme(readmeContent);
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        autoAssignManagerAuthors: ['renovate[bot]', 'dependabot[bot]'],
      });
    });
  });

  describe('Claude OAuth token rotation wiring', () => {
    it('should pass top-level claudeCodeOauthTokenListJsonPath to ProxyClaudeTokenUsageRepository', async () => {
      const configWithTokenPath = {
        ...validConfig,
        claudeCodeOauthTokenListJsonPath:
          '/home/user/creds/claudeCodeOauthTokenList.json',
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: './config.yml',
          maximumPreparingIssuesCount: 3,
        },
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithTokenPath));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(MockedProxyClaudeTokenUsageRepository).toHaveBeenCalledWith(
        '/home/user/creds/claudeCodeOauthTokenList.json',
      );
    });

    it('should pass null when claudeCodeOauthTokenListJsonPath is absent', async () => {
      const configWithoutTokenPath = {
        ...validConfig,
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: './config.yml',
          maximumPreparingIssuesCount: 3,
        },
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithoutTokenPath));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(MockedProxyClaudeTokenUsageRepository).toHaveBeenCalledWith(null);
    });

    it('should pass null when claudeCodeOauthTokenListJsonPath is unset and startPreparation is absent', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(MockedProxyClaudeTokenUsageRepository).toHaveBeenCalledWith(null);
    });

    it('should let README claudeCodeOauthTokenListJsonPath override the YAML value', async () => {
      const readmeContent = `<details>
<summary>config</summary>
claudeCodeOauthTokenListJsonPath: /readme/tokens.json
</details>`;
      mockFetchReturningReadme(readmeContent);
      const configWithTokenPath = {
        ...validConfig,
        claudeCodeOauthTokenListJsonPath: '/yaml/tokens.json',
        startPreparation: {
          defaultAgentName: 'agent1',
          configFilePath: './config.yml',
          maximumPreparingIssuesCount: 3,
        },
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithTokenPath));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(MockedProxyClaudeTokenUsageRepository).toHaveBeenCalledWith(
        '/readme/tokens.json',
      );
    });
  });

  describe('effective config logging', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log the effective values with configFile source when only the YAML config sets them', async () => {
      const configWithPreparation = {
        ...validConfig,
        startPreparation: {
          defaultAgentName: 'yaml-agent',
          defaultLlmModelName: 'yaml-model',
          configFilePath: './config.yml',
          maximumPreparingIssuesCount: 10,
        },
      };
      mockFetchReturningReadme(null);
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective maximumPreparingIssuesCount: 10 (source: configFile)',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultLlmModelName: yaml-model (source: configFile)',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultAgentName: yaml-agent (source: configFile)',
      );
    });

    it('should log the effective values with readmeOverride source when the README config overrides them', async () => {
      const readmeContent = `<details>
<summary>config</summary>
maximumPreparingIssuesCount: 3
defaultLlmModelName: readme-model
defaultAgentName: readme-agent
</details>`;
      mockFetchReturningReadme(readmeContent);
      const configWithPreparation = {
        ...validConfig,
        startPreparation: {
          defaultAgentName: 'yaml-agent',
          defaultLlmModelName: 'yaml-model',
          configFilePath: './config.yml',
          maximumPreparingIssuesCount: 10,
        },
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithPreparation));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective maximumPreparingIssuesCount: 3 (source: readmeOverride)',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultLlmModelName: readme-model (source: readmeOverride)',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultAgentName: readme-agent (source: readmeOverride)',
      );
    });

    it('should log null with unset (default) source when neither README nor config provides the value', async () => {
      mockFetchReturningReadme(null);
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective maximumPreparingIssuesCount: null (source: unset (default))',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultLlmModelName: null (source: unset (default))',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Effective defaultAgentName: null (source: unset (default))',
      );
    });
  });

  describe('inTmuxProjectOrder override', () => {
    const getInTmuxProjectOrderArg = (): string[] | null | undefined => {
      const call = MockedWriteInTmuxByHumanData.mock.calls[0];
      if (call === undefined) {
        throw new Error('writeInTmuxByHumanData was not called');
      }
      return call[0].inTmuxProjectOrder;
    };

    it('should use the CLI override when provided, ignoring the config value', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(
        YAML.stringify({
          ...validConfig,
          inTmuxProjectOrder: ['alpha', 'beta'],
        }),
      );

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false, ['gamma', 'delta']);

      expect(getInTmuxProjectOrderArg()).toEqual(['gamma', 'delta']);
    });

    it('should fall back to the config value when the CLI override is null', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(
        YAML.stringify({
          ...validConfig,
          inTmuxProjectOrder: ['alpha', 'beta'],
        }),
      );

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false, null);

      expect(getInTmuxProjectOrderArg()).toEqual(['alpha', 'beta']);
    });

    it('should fall back to the config value when the override argument is omitted', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(
        YAML.stringify({
          ...validConfig,
          inTmuxProjectOrder: ['alpha', 'beta'],
        }),
      );

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(getInTmuxProjectOrderArg()).toEqual(['alpha', 'beta']);
    });

    it('should pass null when neither the override nor the config provides a value', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false, null);

      expect(getInTmuxProjectOrderArg()).toBeNull();
    });
  });

  it('forwards the exact fetched project to launch reconciliation and cleanup', async () => {
    const project: Project = {
      id: 'selected-project',
      url: 'https://github.com/users/demo/projects/9',
      databaseId: 9,
      name: 'Selected project',
      status: { name: 'Status', fieldId: 'selected-status', statuses: [] },
      nextActionDate: null,
      nextActionHour: null,
      story: null,
      remainingEstimationMinutes: null,
      dependedIssueUrlSeparatedByComma: null,
      completionDate50PercentConfidence: null,
      agent: null,
    };
    mockRun.mockResolvedValueOnce({
      project,
      issues: [],
      cacheUsed: false,
      targetDateTimes: [],
      rotationOrder: null,
    });
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);
    const launchInput = jest.mocked(reconcileInTmuxByHumanSessions).mock
      .calls[0]?.[0];
    expect(
      launchInput && 'project' in launchInput ? launchInput.project : null,
    ).toBe(project);
    expect(jest.mocked(cleanStaleTmuxSessions).mock.calls[0]?.[0].project).toBe(
      project,
    );
  });

  it('runs scheduled cleanup when launch is disabled', async () => {
    mockRun.mockResolvedValueOnce({
      project: mock<Project>({ id: 'PVT_kwHOtest123' }),
      issues: [],
      cacheUsed: false,
      targetDateTimes: [],
      rotationOrder: null,
    });
    jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(validConfig));
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);
    expect(
      jest.mocked(cleanStaleTmuxSessions).mock.calls[0]?.[0].project.id,
    ).toBe('PVT_kwHOtest123');
  });

  it('logs cleanup failures instead of reporting cleanup success', async () => {
    mockRun.mockResolvedValueOnce({
      project: mock<Project>({ id: 'PVT_kwHOtest123' }),
      issues: [],
      cacheUsed: false,
      targetDateTimes: [],
      rotationOrder: null,
    });
    jest
      .mocked(cleanStaleTmuxSessions)
      .mockRejectedValueOnce(new Error('scope stop failed'));
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to clean stale tmux sessions: scope stop failed',
      ),
    );
  });

  describe('owner call file cleanup of closed issues', () => {
    it('should hand the project issues to the cleanup with the configured project code and data directory', async () => {
      jest.mocked(fs.readFileSync).mockReturnValue(
        YAML.stringify({
          ...validConfig,
          inTmuxDataOutputDir: '/data/in-tmux-by-human',
        }),
      );
      const closedIssue = {
        url: 'https://github.com/TestOrg/test-repo/issues/9',
        isClosed: true,
      };
      mockRun.mockResolvedValueOnce({
        project: { id: 'PVT_kwHOtest123' },
        issues: [closedIssue],
        cacheUsed: false,
        targetDateTimes: [],
        rotationOrder: null,
      });

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(jest.mocked(cleanClosedIssueOwnerCallFiles)).toHaveBeenCalledWith({
        inTmuxDataOutputDir: '/data/in-tmux-by-human',
        pjcode: validConfig.projectName,
        issues: [closedIssue],
      });
    });
  });

  describe('silentNotificationEnabled priority chain', () => {
    it('uses project config value when present, ignoring fleet config', async () => {
      const configWithSilentEnabled = {
        ...validConfig,
        silentNotificationEnabled: true,
      };
      jest
        .mocked(fs.readFileSync)
        .mockReturnValue(YAML.stringify(configWithSilentEnabled));
      mockLoadSilentNotificationEnabled.mockReturnValue(false);

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(mockNotifySilentTmuxSessions).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });

    it('uses fleet config value when project config does not specify it', async () => {
      mockLoadSilentNotificationEnabled.mockReturnValue(false);

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(mockNotifySilentTmuxSessions).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('falls back to env var when both project config and fleet config are absent', async () => {
      const originalEnv = process.env.TDPM_SILENT_NOTIFICATION_ENABLED;
      process.env.TDPM_SILENT_NOTIFICATION_ENABLED = 'true';
      mockLoadSilentNotificationEnabled.mockReturnValue(null);

      try {
        const handler = new HandleScheduledEventUseCaseHandler();
        await handler.handle('config.yml', false);

        expect(mockNotifySilentTmuxSessions).toHaveBeenCalledWith(
          expect.objectContaining({ enabled: true }),
        );
      } finally {
        if (originalEnv === undefined) {
          delete process.env.TDPM_SILENT_NOTIFICATION_ENABLED;
        } else {
          process.env.TDPM_SILENT_NOTIFICATION_ENABLED = originalEnv;
        }
      }
    });
  });

  describe('allowedDependencyRepoNameWithOwner wiring', () => {
    it('should pass null when workflowImprovementIssueUrl is absent from fleet config', async () => {
      mockLoadWorkflowImprovementIssueUrl.mockReturnValue(null);

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        allowedDependencyRepoNameWithOwner: null,
      });
    });

    it('should extract owner/repo from workflowImprovementIssueUrl and pass it as allowedDependencyRepoNameWithOwner', async () => {
      mockLoadWorkflowImprovementIssueUrl.mockReturnValue(
        'https://github.com/allowed-owner/allowed-repo/issues/123',
      );

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      expect(capturedRunInputs[0][0]).toMatchObject({
        allowedDependencyRepoNameWithOwner: 'allowed-owner/allowed-repo',
      });
    });
  });

  it('constructs GitHubIssueCommentRepository with a LocalStorageCacheRepository to enable conditional ETag requests', async () => {
    const handler = new HandleScheduledEventUseCaseHandler();
    await handler.handle('config.yml', false);

    expect(MockedGitHubIssueCommentRepository).toHaveBeenCalledWith(
      'test-token',
      expect.any(LocalStorageCacheRepository),
    );
  });

  describe('dashboard row human pending story colors', () => {
    const DASHBOARD_DATA_DIR = '/dashboard-data';
    const DASHBOARD_ROW_TEMPORARY_FILE_PATH = `${DASHBOARD_DATA_DIR}/projects/${validConfig.projectName}.json.tmp`;

    const storyOption = (
      id: string,
      name: string,
      color: FieldOption['color'],
    ): FieldOption => ({ id, name, color, description: '' });

    const projectWithStoryOptions = (stories: FieldOption[]): Project => ({
      id: 'PVT_kwHOtest123',
      url: 'https://github.com/users/TestOrg/projects/1',
      databaseId: 1,
      name: 'test-project',
      status: {
        name: 'Status',
        fieldId: 'status-field',
        statuses: [],
      },
      nextActionDate: null,
      nextActionHour: null,
      story: {
        name: 'story',
        fieldId: 'story-field',
        databaseId: 2,
        stories,
        workflowManagementStory: { id: 'wm', name: 'workflow management' },
      },
      remainingEstimationMinutes: null,
      dependedIssueUrlSeparatedByComma: null,
      completionDate50PercentConfidence: null,
      agent: null,
    });

    const pendingIssue = (
      number: number,
      status: string,
      story: string,
      storyOptionId: string | null | undefined,
    ): Issue => ({
      nameWithOwner: 'TestOrg/test-repo',
      number,
      title: `Issue ${number}`,
      state: 'OPEN',
      status,
      story,
      storyOptionId,
      nextActionDate: null,
      nextActionHour: null,
      estimationMinutes: null,
      dependedIssueUrls: [],
      completionDate50PercentConfidence: null,
      url: `https://github.com/TestOrg/test-repo/issues/${number}`,
      assignees: ['TestManager'],
      labels: [],
      org: 'TestOrg',
      repo: 'test-repo',
      body: '',
      itemId: `item-${number}`,
      isPr: false,
      isInProgress: false,
      isClosed: false,
      createdAt: new Date('2026-06-13T08:18:45.000Z'),
      author: 'someone',
      closingIssueReferenceUrls: [],
      plainCrossRepoIssueReferenceUrls: [],
      agent: null,
      stateReason: null,
    });

    const readDashboardRowWrittenByHandler = async (
      project: Project,
      issues: Issue[],
    ): Promise<unknown> => {
      jest.mocked(fs.readFileSync).mockReturnValue(
        YAML.stringify({
          ...validConfig,
          dashboardDataDir: DASHBOARD_DATA_DIR,
        }),
      );
      mockRun.mockImplementationOnce(async (...args: Parameters<RunFn>) => {
        await args[0].afterIssuesFetched?.(project, issues);
        return null;
      });

      const handler = new HandleScheduledEventUseCaseHandler();
      await handler.handle('config.yml', false);

      const dashboardRowTexts = jest
        .mocked(fs.writeFileSync)
        .mock.calls.filter(
          ([filePath]) => filePath === DASHBOARD_ROW_TEMPORARY_FILE_PATH,
        )
        .map(([, writtenContent]) => writtenContent)
        .filter(
          (writtenContent): writtenContent is string =>
            typeof writtenContent === 'string',
        );
      expect(dashboardRowTexts).toHaveLength(1);
      const dashboardRow: unknown = JSON.parse(dashboardRowTexts[0]);
      return dashboardRow;
    };

    it('counts pending issues of uniquely named stories under the color of their story', async () => {
      const dashboardRow = await readDashboardRowWrittenByHandler(
        projectWithStoryOptions([
          storyOption('opt-red-story', 'Red Story', 'RED'),
          storyOption('opt-yellow-story', 'Yellow Story', 'YELLOW'),
          storyOption('opt-blue-story', 'Blue Story', 'BLUE'),
        ]),
        [
          pendingIssue(1, 'Awaiting Owner', 'Red Story', 'opt-red-story'),
          pendingIssue(2, 'Todo by human', 'Red Story', 'opt-red-story'),
          pendingIssue(3, 'Awaiting Owner', 'Yellow Story', 'opt-yellow-story'),
          pendingIssue(4, 'Todo by human', 'Blue Story', 'opt-blue-story'),
          pendingIssue(5, 'Preparation', 'Blue Story', 'opt-blue-story'),
        ],
      );

      expect(dashboardRow).toMatchObject({
        humanPendingRed: 2,
        humanPendingYellow: 1,
        humanPendingBlue: 1,
      });
    });

    it('counts pending issues of two same-named stories under the color of the option each issue references', async () => {
      const dashboardRow = await readDashboardRowWrittenByHandler(
        projectWithStoryOptions([
          storyOption('opt-duplicate-red', 'Duplicate Story', 'RED'),
          storyOption('opt-duplicate-blue', 'Duplicate Story', 'BLUE'),
        ]),
        [
          pendingIssue(
            1,
            'Awaiting Owner',
            'Duplicate Story',
            'opt-duplicate-red',
          ),
          pendingIssue(
            2,
            'Awaiting Owner',
            'Duplicate Story',
            'opt-duplicate-blue',
          ),
          pendingIssue(
            3,
            'Todo by human',
            'Duplicate Story',
            'opt-duplicate-blue',
          ),
        ],
      );

      expect(dashboardRow).toMatchObject({
        humanPendingRed: 1,
        humanPendingYellow: 0,
        humanPendingBlue: 2,
      });
    });

    it.each([
      { storyOptionIdDescription: 'null', storyOptionId: null },
      { storyOptionIdDescription: 'undefined', storyOptionId: undefined },
    ])(
      'never counts a pending issue whose story option id is $storyOptionIdDescription even when its story name has a color',
      async ({ storyOptionId }) => {
        const dashboardRow = await readDashboardRowWrittenByHandler(
          projectWithStoryOptions([
            storyOption('opt-red-story', 'Red Story', 'RED'),
            storyOption('opt-blue-story', 'Blue Story', 'BLUE'),
          ]),
          [
            pendingIssue(1, 'Awaiting Owner', 'Red Story', storyOptionId),
            pendingIssue(2, 'Todo by human', 'Blue Story', storyOptionId),
          ],
        );

        expect(dashboardRow).toMatchObject({
          humanPendingRed: 0,
          humanPendingYellow: 0,
          humanPendingBlue: 0,
        });
      },
    );
  });

  describe('llmModelNameByAgentName fleet map', () => {
    const fleetConfigFileName = 'test-fleet.config.yaml';
    const actualFleetConfig =
      jest.requireActual<typeof import('../cli/fleetConfig')>(
        '../cli/fleetConfig',
      );
    let consoleLines: string[] = [];
    let consoleSpies: jest.SpyInstance[] = [];

    const effectiveMapLines = (): string[] =>
      consoleLines.filter((line) =>
        line.startsWith('Effective llmModelNameByAgentName:'),
      );

    const mockConfigFiles = (
      projectConfigContent: string,
      fleetConfigContent: string | null,
    ): void => {
      mockResolveFleetConfigFilePath.mockReturnValue(
        fleetConfigContent === null ? null : fleetConfigFileName,
      );
      mockLoadStartPreparationFleetSettings.mockImplementation(
        actualFleetConfig.loadStartPreparationFleetSettings,
      );
      jest
        .mocked(fs.readFileSync)
        .mockImplementation((filePath) =>
          filePath === fleetConfigFileName && fleetConfigContent !== null
            ? fleetConfigContent
            : projectConfigContent,
        );
    };

    const runSchedule = async (): Promise<unknown> =>
      new HandleScheduledEventUseCaseHandler().handle('config.yml', false);

    beforeEach(() => {
      consoleLines = [];
      const recordLine = (...args: unknown[]): void => {
        consoleLines.push(args.map((arg) => String(arg)).join(' '));
      };
      consoleSpies = [
        jest.spyOn(console, 'log').mockImplementation(recordLine),
        jest.spyOn(console, 'warn').mockImplementation(recordLine),
        jest.spyOn(console, 'error').mockImplementation(recordLine),
      ];
    });

    afterEach(() => {
      consoleSpies.forEach((spy) => spy.mockRestore());
    });

    it('passes a null map when only the project configuration has a map (AC-01)', async () => {
      mockConfigFiles(
        YAML.stringify({
          ...validConfig,
          startPreparation: {
            llmModelNameByAgentName: { triager: 'claude-sonnet-5-5' },
          },
        }),
        YAML.stringify({
          startPreparation: { maximumPreparingIssuesCount: 80 },
        }),
      );

      await runSchedule();

      expect(capturedRunInputs).toHaveLength(1);
      expect(capturedRunInputs[0][0]).toHaveProperty(
        'llmModelNameByAgentName',
        null,
      );
    });

    it('passes the fleet configuration map to the schedule run (AC-01)', async () => {
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: {
            llmModelNameByAgentName: { triager: 'claude-haiku-5-5' },
          },
        }),
      );

      await runSchedule();

      expect(capturedRunInputs[0][0]).toHaveProperty(
        'llmModelNameByAgentName',
        { triager: 'claude-haiku-5-5' },
      );
    });

    it('passes a null map and prints the README key warning when the README has the key (AC-01)', async () => {
      mockFetchReturningReadme(`<details>
<summary>config</summary>
llmModelNameByAgentName: claude-haiku-5-5
</details>`);
      mockConfigFiles(
        YAML.stringify({
          ...validConfig,
          startPreparation: { maximumPreparingIssuesCount: 3 },
        }),
        YAML.stringify({
          startPreparation: { maximumPreparingIssuesCount: 80 },
        }),
      );

      await runSchedule();

      expect(capturedRunInputs[0][0]).toHaveProperty(
        'llmModelNameByAgentName',
        null,
      );
      expect(consoleLines).toContain(
        'Unknown key "llmModelNameByAgentName" in project README config section (project URL: https://github.com/users/TestOrg/projects/1)',
      );
    });

    it('passes a null map without error when the project configuration map is a number (AC-01)', async () => {
      mockConfigFiles(
        YAML.stringify({
          ...validConfig,
          startPreparation: { llmModelNameByAgentName: 3 },
        }),
        YAML.stringify({
          startPreparation: { maximumPreparingIssuesCount: 80 },
        }),
      );

      await runSchedule();

      expect(capturedRunInputs[0][0]).toHaveProperty(
        'llmModelNameByAgentName',
        null,
      );
    });

    it('prints exactly one Effective map line that names an unmatched key (AC-16)', async () => {
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: {
            llmModelNameByAgentName: {
              'no-such-agent': 'claude-haiku-5-5',
            },
          },
        }),
      );

      await runSchedule();

      const linesNamingKey = consoleLines.filter((line) =>
        line.includes('no-such-agent'),
      );
      expect(linesNamingKey).toHaveLength(1);
      expect(linesNamingKey[0]).toMatch(/^Effective llmModelNameByAgentName:/);
    });

    it('prints the Effective line with only the non-null entry (AC-17)', async () => {
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: {
            llmModelNameByAgentName: {
              triager: 'claude-haiku-5-5',
              'acceptance-tester': null,
            },
          },
        }),
      );

      await runSchedule();

      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: {"triager":"claude-haiku-5-5"} (source: fleetConfig)',
      ]);
    });

    it.each([
      {
        description: 'a missing key',
        fleetConfig: { startPreparation: { maximumPreparingIssuesCount: 80 } },
      },
      {
        description: 'a null value',
        fleetConfig: { startPreparation: { llmModelNameByAgentName: null } },
      },
      {
        description: 'a misspelled key',
        fleetConfig: {
          startPreparation: {
            llmModelNameByAgentNames: { triager: 'claude-haiku-5-5' },
          },
        },
      },
    ])(
      'prints exactly one null Effective map line for $description (AC-18)',
      async ({ fleetConfig }) => {
        mockConfigFiles(
          YAML.stringify(validConfig),
          YAML.stringify(fleetConfig),
        );

        await runSchedule();

        expect(effectiveMapLines()).toEqual([
          'Effective llmModelNameByAgentName: null (source: fleetConfig)',
        ]);
      },
    );

    it('prints exactly one built-in default null Effective map line when TDPM_FLEET_CONFIG is unset (AC-18)', async () => {
      mockConfigFiles(YAML.stringify(validConfig), null);

      await runSchedule();

      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: null (source: built-in default)',
      ]);
    });

    it('rejects the schedule run with the map error and does not call the launch run (AC-25)', async () => {
      mockFetchReturningReadme('# Test project');
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: { llmModelNameByAgentName: 'claude-haiku-5-5' },
        }),
      );

      await expect(runSchedule()).rejects.toThrow(
        'startPreparation.llmModelNameByAgentName in test-fleet.config.yaml must be a mapping.',
      );
      expect(mockRun).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: 'a number map value',
        mapValue: 3,
      },
      {
        description: 'a boolean map value',
        mapValue: true,
      },
      {
        description: 'a list map value',
        mapValue: ['claude-haiku-5-5'],
      },
      {
        description: 'an empty string per-agent value',
        mapValue: { triager: '' },
      },
      {
        description: 'a number per-agent value',
        mapValue: { triager: 3 },
      },
      {
        description: 'a boolean per-agent value',
        mapValue: { triager: true },
      },
      {
        description: 'a list per-agent value',
        mapValue: { triager: ['claude-haiku-5-5'] },
      },
      {
        description: 'a mapping per-agent value',
        mapValue: { triager: { model: 'claude-haiku-5-5' } },
      },
    ])(
      'rejects the schedule run without calling the launch run for $description (AC-25)',
      async ({ mapValue }) => {
        mockFetchReturningReadme('# Test project');
        mockConfigFiles(
          YAML.stringify(validConfig),
          YAML.stringify({
            startPreparation: { llmModelNameByAgentName: mapValue },
          }),
        );

        await expect(runSchedule()).rejects.toThrow();
        expect(mockRun).not.toHaveBeenCalled();
      },
    );

    it('prints no Effective map line when the fleet map read fails (AC-26)', async () => {
      mockFetchReturningReadme('# Test project');
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: { llmModelNameByAgentName: 'claude-haiku-5-5' },
        }),
      );

      await expect(runSchedule()).rejects.toThrow(
        'startPreparation.llmModelNameByAgentName in test-fleet.config.yaml must be a mapping.',
      );
      expect(effectiveMapLines()).toEqual([]);
    });

    it('prints exactly one empty-map Effective line when the read map is {} (AC-32)', async () => {
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({ startPreparation: { llmModelNameByAgentName: {} } }),
      );

      await runSchedule();

      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: {} (source: fleetConfig)',
      ]);
    });

    it('prints exactly one empty-map Effective line when only the project configuration has a map (AC-32)', async () => {
      mockConfigFiles(
        YAML.stringify({
          ...validConfig,
          startPreparation: {
            llmModelNameByAgentName: { triager: 'claude-sonnet-5-5' },
          },
        }),
        YAML.stringify({ startPreparation: { llmModelNameByAgentName: {} } }),
      );

      await runSchedule();

      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: {} (source: fleetConfig)',
      ]);
    });

    it('prints no Effective map line when the project configuration is disabled, and prints one when enabled (AC-33)', async () => {
      const fleetConfig = YAML.stringify({
        startPreparation: {
          llmModelNameByAgentName: { triager: 'claude-haiku-5-5' },
        },
      });
      mockConfigFiles(
        YAML.stringify({ ...validConfig, disabled: true }),
        fleetConfig,
      );

      await expect(runSchedule()).resolves.toBeNull();
      expect(effectiveMapLines()).toEqual([]);

      consoleLines = [];
      mockConfigFiles(YAML.stringify(validConfig), fleetConfig);
      await runSchedule();
      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: {"triager":"claude-haiku-5-5"} (source: fleetConfig)',
      ]);
    });

    it('prints no Effective map line when the project configuration lacks a credential, and prints one when valid (AC-33)', async () => {
      const fleetConfig = YAML.stringify({
        startPreparation: {
          llmModelNameByAgentName: { triager: 'claude-haiku-5-5' },
        },
      });
      mockConfigFiles(YAML.stringify({}), fleetConfig);

      await expect(runSchedule()).rejects.toThrow('Invalid input');
      expect(effectiveMapLines()).toEqual([]);

      consoleLines = [];
      mockConfigFiles(YAML.stringify(validConfig), fleetConfig);
      await runSchedule();
      expect(effectiveMapLines()).toEqual([
        'Effective llmModelNameByAgentName: {"triager":"claude-haiku-5-5"} (source: fleetConfig)',
      ]);
    });

    it('passes the map read by each schedule run, not the previous run (AC-36)', async () => {
      mockConfigFiles(
        YAML.stringify(validConfig),
        YAML.stringify({
          startPreparation: { maximumPreparingIssuesCount: 80 },
        }),
      );
      const firstFleetSettings = {
        maximumPreparingIssuesCount: 80,
        llmModelNameByAgentName: { triager: 'claude-haiku-5-5' },
      };
      const secondFleetSettings = {
        maximumPreparingIssuesCount: 80,
        llmModelNameByAgentName: { triager: 'claude-sonnet-5-5' },
      };
      mockLoadStartPreparationFleetSettings
        .mockReturnValueOnce(firstFleetSettings)
        .mockReturnValueOnce(secondFleetSettings);

      await runSchedule();
      await runSchedule();

      expect(mockLoadStartPreparationFleetSettings).toHaveBeenCalledTimes(2);
      expect(capturedRunInputs).toHaveLength(2);
      expect(capturedRunInputs[1][0]).toHaveProperty(
        'llmModelNameByAgentName',
        { triager: 'claude-sonnet-5-5' },
      );
    });
  });
});
