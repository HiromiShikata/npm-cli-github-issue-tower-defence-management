import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { mock } from 'jest-mock-extended';
import { localStorageCacheBaseDirectory } from '../../repositories/localStorageCacheDirectory';
import type { Project } from '../../../domain/entities/Project';
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
  ProxyClaudeTokenUsageRepository: jest
    .fn()
    .mockImplementation((tokenListJsonPath: string | null) => ({
      tokenListJsonPath,
    })),
}));
jest.mock(
  '../../repositories/LocalStorageUrgentStoryLaunchHoldRepository',
  () => ({
    LocalStorageUrgentStoryLaunchHoldRepository: jest
      .fn()
      .mockImplementation(() => ({
        holdRepositoryTag: 'urgent-story-launch-hold',
      })),
  }),
);
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
  loadFleetClaudeCodeOauthTokenListJsonPath: jest.fn(),
}));
jest.mock('./notifySilentTmuxSessions', () => ({
  notifySilentTmuxSessions: jest.fn().mockResolvedValue(undefined),
}));

import { HandleScheduledEventUseCaseHandler } from './HandleScheduledEventUseCaseHandler';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { LocalStorageUrgentStoryLaunchHoldRepository } from '../../repositories/LocalStorageUrgentStoryLaunchHoldRepository';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { resetProjectReadmeInMemoryCacheForTesting } from '../cli/projectConfig';
import {
  loadFleetClaudeCodeOauthTokenListJsonPath,
  loadSilentNotificationEnabled,
  loadWorkflowImprovementIssueUrl,
  loadStartPreparationFleetSettings,
  loadWorkflowIssueReporterSettings,
  resolveFleetConfigFilePath,
} from '../cli/fleetConfig';

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
const mockLoadFleetClaudeCodeOauthTokenListJsonPath = jest.mocked(
  loadFleetClaudeCodeOauthTokenListJsonPath,
);
const mockResolveFleetConfigFilePath = jest.mocked(resolveFleetConfigFilePath);
const MockedLocalStorageUrgentStoryLaunchHoldRepository = jest.mocked(
  LocalStorageUrgentStoryLaunchHoldRepository,
);
const MockedStartPreparationUseCase = jest.mocked(StartPreparationUseCase);

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

const FLEET_CONFIG_FILE_PATH = '/srv/fleet/fleet.config.yaml';
const URGENT_STORY_NAMES = [
  'urgent / production incident',
  'urgent / customer escalation',
];

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
  startPreparation: {
    defaultAgentName: 'agent1',
    configFilePath: './config.yml',
    maximumPreparingIssuesCount: 3,
  },
};

const mockFetchReturningNoReadme = (): void => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

const fleetTokenListJsonPathReturn = (
  fleetTokenListJsonPath: string | null,
): void => {
  mockLoadFleetClaudeCodeOauthTokenListJsonPath.mockImplementation(
    (fleetConfigFilePath) =>
      fleetConfigFilePath === FLEET_CONFIG_FILE_PATH
        ? fleetTokenListJsonPath
        : null,
  );
};

const projectConfigUse = (config: object): void => {
  jest.mocked(fs.readFileSync).mockReturnValue(YAML.stringify(config));
};

describe('HandleScheduledEventUseCaseHandler urgent-story launch hold wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedRunInputs.length = 0;
    projectConfigUse(validConfig);
    mockGetLastIssuesFetchedAt.mockReturnValue('2026-08-09T02:00:00.000Z');
    mockLocalStorageCacheGetSingle.mockResolvedValue(null);
    mockLocalStorageCacheSetSingle.mockResolvedValue(undefined);
    resetProjectReadmeInMemoryCacheForTesting();
    mockFetchReturningNoReadme();
    mockResolveFleetConfigFilePath.mockReturnValue(FLEET_CONFIG_FILE_PATH);
    mockLoadSilentNotificationEnabled.mockReturnValue(null);
    mockLoadStartPreparationFleetSettings.mockReturnValue({
      maximumPreparingIssuesCount: 80,
      urgentStoryNames: URGENT_STORY_NAMES,
    });
    mockLoadWorkflowImprovementIssueUrl.mockReturnValue(null);
    mockLoadWorkflowIssueReporterSettings.mockReturnValue(null);
    fleetTokenListJsonPathReturn('/srv/fleet/claude-code-oauth-tokens.json');
  });

  it('passes the fleet urgentStoryNames inside startPreparation to HandleScheduledEventUseCase.run', async () => {
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);

    expect(capturedRunInputs).toHaveLength(1);
    expect(capturedRunInputs[0][0].startPreparation).toEqual(
      expect.objectContaining({ urgentStoryNames: URGENT_STORY_NAMES }),
    );
  });

  it('builds the hold repository on the local storage cache base, the proc directory and this process', async () => {
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);

    expect(
      MockedLocalStorageUrgentStoryLaunchHoldRepository.mock.calls,
    ).toEqual([
      [
        expect.objectContaining({
          cacheBaseDirectoryPath: localStorageCacheBaseDirectory(),
          procDirectoryPath: '/proc',
          processId: process.pid,
        }),
      ],
    ]);
  });

  it('gives StartPreparationUseCase the hold repository and a sleeper as its last two constructor arguments', async () => {
    await new HandleScheduledEventUseCaseHandler().handle('config.yml', false);

    const startPreparationConstructorArguments =
      MockedStartPreparationUseCase.mock.calls[0];
    expect(MockedStartPreparationUseCase.mock.calls).toHaveLength(1);
    expect(startPreparationConstructorArguments[7]).toEqual({
      holdRepositoryTag: 'urgent-story-launch-hold',
    });
    expect(typeof startPreparationConstructorArguments[8]?.sleep).toBe(
      'function',
    );
  });

  it.each<{
    label: string;
    projectTokenListJsonPath: string | null;
    fleetTokenListJsonPath: string | null;
    expectedClaudeTokenUsageRepository: { tokenListJsonPath: string } | null;
  }>([
    {
      label: 'the project config value when the project config sets one',
      projectTokenListJsonPath: '/srv/project/claude-code-oauth-tokens.json',
      fleetTokenListJsonPath: '/srv/fleet/claude-code-oauth-tokens.json',
      expectedClaudeTokenUsageRepository: {
        tokenListJsonPath: '/srv/project/claude-code-oauth-tokens.json',
      },
    },
    {
      label:
        'the project config value with its leading ~/ expanded to the home directory',
      projectTokenListJsonPath: '~/project/claude-code-oauth-tokens.json',
      fleetTokenListJsonPath: '/srv/fleet/claude-code-oauth-tokens.json',
      expectedClaudeTokenUsageRepository: {
        tokenListJsonPath: path.join(
          os.homedir(),
          'project/claude-code-oauth-tokens.json',
        ),
      },
    },
    {
      label: 'the fleet value when the project config sets none',
      projectTokenListJsonPath: null,
      fleetTokenListJsonPath: '/srv/fleet/claude-code-oauth-tokens.json',
      expectedClaudeTokenUsageRepository: {
        tokenListJsonPath: '/srv/fleet/claude-code-oauth-tokens.json',
      },
    },
    {
      label:
        'the fleet value with its leading ~/ expanded to the home directory',
      projectTokenListJsonPath: null,
      fleetTokenListJsonPath: '~/fleet/claude-code-oauth-tokens.json',
      expectedClaudeTokenUsageRepository: {
        tokenListJsonPath: path.join(
          os.homedir(),
          'fleet/claude-code-oauth-tokens.json',
        ),
      },
    },
    {
      label:
        'no token repository when neither the project config nor the fleet config sets a token list',
      projectTokenListJsonPath: null,
      fleetTokenListJsonPath: null,
      expectedClaudeTokenUsageRepository: null,
    },
  ])(
    'reads token usages for the hold from $label',
    async ({
      projectTokenListJsonPath,
      fleetTokenListJsonPath,
      expectedClaudeTokenUsageRepository,
    }) => {
      projectConfigUse(
        projectTokenListJsonPath === null
          ? validConfig
          : {
              ...validConfig,
              claudeCodeOauthTokenListJsonPath: projectTokenListJsonPath,
            },
      );
      fleetTokenListJsonPathReturn(fleetTokenListJsonPath);

      await new HandleScheduledEventUseCaseHandler().handle(
        'config.yml',
        false,
      );

      expect(
        MockedLocalStorageUrgentStoryLaunchHoldRepository.mock.calls,
      ).toEqual([
        [
          expect.objectContaining({
            claudeTokenUsageRepository: expectedClaudeTokenUsageRepository,
          }),
        ],
      ]);
    },
  );
});
