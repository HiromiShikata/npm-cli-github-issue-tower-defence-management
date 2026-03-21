import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  program,
  loadConfigFile,
  parseProjectReadmeConfig,
  mergeConfigs,
  fetchProjectReadme,
} from './index';
import { StartPreparationUseCase } from '../../../domain/usecases/StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from '../../../domain/usecases/NotifyFinishedIssuePreparationUseCase';

jest.mock('../../../domain/usecases/StartPreparationUseCase');
jest.mock('../../../domain/usecases/NotifyFinishedIssuePreparationUseCase');
jest.mock('../../repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/LocalStorageCacheRepository', () => ({
  LocalStorageCacheRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/GraphqlProjectRepository', () => ({
  GraphqlProjectRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/CheerioProjectRepository', () => ({
  CheerioProjectRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/issue/ApiV3IssueRepository', () => ({
  ApiV3IssueRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/issue/RestIssueRepository', () => ({
  RestIssueRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/issue/GraphqlProjectItemRepository', () => ({
  GraphqlProjectItemRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/issue/ApiV3CheerioRestIssueRepository', () => ({
  ApiV3CheerioRestIssueRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/NodeLocalCommandRunner', () => ({
  NodeLocalCommandRunner: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/OauthAPIClaudeRepository', () => ({
  OauthAPIClaudeRepository: jest.fn().mockImplementation(() => ({
    getUsage: jest.fn(),
    isClaudeAvailable: jest.fn(),
  })),
}));
jest.mock('../../repositories/GitHubIssueCommentRepository', () => ({
  GitHubIssueCommentRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/FetchWebhookRepository', () => ({
  FetchWebhookRepository: jest.fn().mockImplementation(() => ({
    sendGetRequest: jest.fn(),
  })),
}));
jest.mock('../handlers/HandleScheduledEventUseCaseHandler', () => ({
  HandleScheduledEventUseCaseHandler: jest.fn().mockImplementation(() => ({
    handle: jest.fn().mockResolvedValue(null),
  })),
}));

describe('CLI', () => {
  const originalEnv = process.env;
  const tmpDir = path.join(__dirname, '../../../../tmp/test-cli');
  const configFilePath = path.join(tmpDir, 'config.yml');

  const defaultConfig = {
    projectUrl: 'https://github.com/orgs/test/projects/1',
    awaitingWorkspaceStatus: 'Awaiting',
    preparationStatus: 'Preparing',
    defaultAgentName: 'agent1',
    awaitingQualityCheckStatus: 'Awaiting QC',
    projectName: 'test-project',
  };

  const writeConfig = (config: Record<string, unknown>): void => {
    fs.writeFileSync(configFilePath, YAML.stringify(config));
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

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmdirSync(tmpDir);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchReturningReadme(null);
    process.env = { ...originalEnv, GH_TOKEN: 'test-token' };
    writeConfig(defaultConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export program', () => {
    expect(program).toBeDefined();
  });

  describe('loadConfigFile', () => {
    it('should load config from YAML file', () => {
      const config = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: '/path/to/log.txt',
        maximumPreparingIssuesCount: 10,
        allowIssueCacheMinutes: 5,
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 5,
        workflowBlockerResolvedWebhookUrl: 'https://example.com/webhook',
        projectName: 'test-project',
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual(config);
    });

    it('should return empty config for empty YAML', () => {
      fs.writeFileSync(configFilePath, '');

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual({});
    });

    it('should ignore non-string values for string fields', () => {
      const config = {
        projectUrl: 123,
        awaitingWorkspaceStatus: true,
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result.projectUrl).toBeUndefined();
      expect(result.awaitingWorkspaceStatus).toBeUndefined();
    });

    it('should ignore non-number values for number fields', () => {
      const config = {
        maximumPreparingIssuesCount: 'abc',
        allowIssueCacheMinutes: 'def',
        thresholdForAutoReject: 'ghi',
      };
      writeConfig(config);

      const result = loadConfigFile(configFilePath);

      expect(result.maximumPreparingIssuesCount).toBeUndefined();
      expect(result.allowIssueCacheMinutes).toBeUndefined();
      expect(result.thresholdForAutoReject).toBeUndefined();
    });

    it('should return empty config for array YAML', () => {
      fs.writeFileSync(configFilePath, '- item1\n- item2\n');

      const result = loadConfigFile(configFilePath);

      expect(result).toEqual({});
    });

    it('should exit with error when config file does not exist', () => {
      const nonExistentPath = path.join(tmpDir, 'nonexistent-config.yml');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      expect(() => loadConfigFile(nonExistentPath)).toThrow(
        'process.exit called',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to load configuration file "${nonExistentPath}"`,
        ),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('parseProjectReadmeConfig', () => {
    it('should parse YAML from details/summary config section', () => {
      const readme = `# Project
Some description
<details>
<summary>config</summary>
awaitingWorkspaceStatus: 'Custom Awaiting'
preparationStatus: 'Custom Preparing'
defaultAgentName: 'readme-agent'
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.awaitingWorkspaceStatus).toBe('Custom Awaiting');
      expect(result.preparationStatus).toBe('Custom Preparing');
      expect(result.defaultAgentName).toBe('readme-agent');
    });

    it('should return empty config when no details/summary section exists', () => {
      const readme = '# Project\nSome description without config section';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should return empty config when details section has empty content', () => {
      const readme = '<details>\n<summary>config</summary>\n</details>';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should return empty config when YAML content is not a record', () => {
      const readme =
        '<details>\n<summary>config</summary>\n- item1\n- item2\n</details>';

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
    });

    it('should handle invalid YAML gracefully', () => {
      const readme =
        '<details>\n<summary>config</summary>\ninvalid: [unclosed\n</details>';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = parseProjectReadmeConfig(readme);

      expect(result).toEqual({});
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to parse YAML from project README config section',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should parse number fields from README config', () => {
      const readme = `<details>
<summary>config</summary>
maximumPreparingIssuesCount: 15
allowIssueCacheMinutes: 10
thresholdForAutoReject: 5
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.maximumPreparingIssuesCount).toBe(15);
      expect(result.allowIssueCacheMinutes).toBe(10);
      expect(result.thresholdForAutoReject).toBe(5);
    });

    it('should be case-insensitive for the summary tag', () => {
      const readme = `<details>
<SUMMARY>config</SUMMARY>
defaultAgentName: 'case-test-agent'
</details>`;

      const result = parseProjectReadmeConfig(readme);

      expect(result.defaultAgentName).toBe('case-test-agent');
    });
  });

  describe('mergeConfigs', () => {
    it('should use configFile values when no overrides', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };

      const result = mergeConfigs(configFile, {}, {});

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('config-agent');
    });

    it('should use CLI overrides over configFile', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };
      const cliOverrides = {
        defaultAgentName: 'cli-agent',
      };

      const result = mergeConfigs(configFile, cliOverrides, {});

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('cli-agent');
    });

    it('should use README overrides over both CLI and configFile', () => {
      const configFile = {
        projectUrl: 'https://github.com/config/project',
        defaultAgentName: 'config-agent',
      };
      const cliOverrides = {
        defaultAgentName: 'cli-agent',
      };
      const readmeOverrides = {
        defaultAgentName: 'readme-agent',
      };

      const result = mergeConfigs(configFile, cliOverrides, readmeOverrides);

      expect(result.projectUrl).toBe('https://github.com/config/project');
      expect(result.defaultAgentName).toBe('readme-agent');
    });

    it('should preserve projectName from configFile', () => {
      const configFile = {
        projectName: 'my-project',
        projectUrl: 'https://github.com/config/project',
      };

      const result = mergeConfigs(configFile, {}, {});

      expect(result.projectName).toBe('my-project');
    });
  });

  describe('fetchProjectReadme', () => {
    it('should fetch README from GitHub GraphQL API', async () => {
      const responseBody = {
        data: {
          organization: {
            projectV2: { readme: '# Project README' },
          },
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(responseBody), { status: 200 }),
        );

      const result = await fetchProjectReadme(
        'https://github.com/orgs/test-org/projects/1',
        'test-token',
      );

      expect(result).toBe('# Project README');
    });

    it('should try user if organization readme is null', async () => {
      const responseBody = {
        data: {
          organization: { projectV2: { readme: null } },
          user: { projectV2: { readme: '# User Project README' } },
        },
      };
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(responseBody), { status: 200 }),
        );

      const result = await fetchProjectReadme(
        'https://github.com/users/test-user/projects/1',
        'test-token',
      );

      expect(result).toBe('# User Project README');
    });

    it('should return null and warn on failure', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await fetchProjectReadme(
        'https://github.com/orgs/test/projects/1',
        'test-token',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch project README',
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('startDaemon', () => {
    it('should read parameters from config file', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        allowIssueCacheMinutes: 0,
      });
    });

    it('should allow CLI args to override config file values', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
        '--projectUrl',
        'https://github.com/orgs/override/projects/2',
        '--defaultAgentName',
        'override-agent',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/orgs/override/projects/2',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'override-agent',
        logFilePath: undefined,
        maximumPreparingIssuesCount: null,
        allowIssueCacheMinutes: 0,
      });
    });

    it('should pass logFilePath from config file', async () => {
      const configWithLog = {
        ...defaultConfig,
        logFilePath: '/path/to/log.txt',
      };
      writeConfig(configWithLog);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          logFilePath: '/path/to/log.txt',
        }),
      );
    });

    it('should pass maximumPreparingIssuesCount from config file', async () => {
      const configWithCount = {
        ...defaultConfig,
        maximumPreparingIssuesCount: 10,
      };
      writeConfig(configWithCount);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          maximumPreparingIssuesCount: 10,
        }),
      );
    });

    it('should pass maximumPreparingIssuesCount from CLI overriding config', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
        '--maximumPreparingIssuesCount',
        '20',
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          maximumPreparingIssuesCount: 20,
        }),
      );
    });

    it('should exit with error for non-numeric maximumPreparingIssuesCount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
          '--maximumPreparingIssuesCount',
          'abc',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error for negative maximumPreparingIssuesCount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
          '--maximumPreparingIssuesCount',
          '-5',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --maximumPreparingIssuesCount. It must be a positive integer.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when GH_TOKEN is missing', async () => {
      delete process.env.GH_TOKEN;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GH_TOKEN environment variable is required',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when projectUrl is missing from both CLI and config', async () => {
      const configWithoutProjectUrl = {
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
      };
      writeConfig(configWithoutProjectUrl);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingWorkspaceStatus is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        preparationStatus: 'Preparing',
        defaultAgentName: 'agent1',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when preparationStatus is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        awaitingWorkspaceStatus: 'Awaiting',
        defaultAgentName: 'agent1',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when defaultAgentName is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        awaitingWorkspaceStatus: 'Awaiting',
        preparationStatus: 'Preparing',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'startDaemon',
          '--configFilePath',
          configFilePath,
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'defaultAgentName is required. Provide via --defaultAgentName, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should log maximumPreparingIssuesCount before calling useCase.run', async () => {
      const configWithValues = {
        ...defaultConfig,
        maximumPreparingIssuesCount: 10,
      };
      writeConfig(configWithValues);

      const callOrder: string[] = [];
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {
          callOrder.push('console.log');
        });
      const mockRun = jest.fn().mockImplementation(() => {
        callOrder.push('useCase.run');
        return Promise.resolve(undefined);
      });
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
      ]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'maximumPreparingIssuesCount: 10',
      );
      expect(mockRun).toHaveBeenCalledTimes(1);
      const logIndex = callOrder.indexOf('console.log');
      const runIndex = callOrder.indexOf('useCase.run');
      expect(logIndex).toBeLessThan(runIndex);

      consoleLogSpy.mockRestore();
    });

    it('should apply README config overrides', async () => {
      const readmeContent = [
        '# Project',
        '<details>',
        '<summary>config</summary>',
        'defaultAgentName: readme-agent',
        '</details>',
      ].join('\n');
      mockFetchReturningReadme(readmeContent);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedStartPreparationUseCase = jest.mocked(
        StartPreparationUseCase,
      );

      MockedStartPreparationUseCase.mockImplementation(function (
        this: StartPreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'startDaemon',
        '--configFilePath',
        configFilePath,
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultAgentName: 'readme-agent',
        }),
      );
    });
  });

  describe('notifyFinishedIssuePreparation', () => {
    it('should read parameters from config file', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
      ]);

      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        issueUrl: 'https://github.com/test/repo/issues/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });
    });

    it('should allow CLI args to override config file values', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
        '--projectUrl',
        'https://github.com/orgs/override/projects/2',
        '--awaitingQualityCheckStatus',
        'Override QC',
      ]);

      expect(mockRun).toHaveBeenCalledWith({
        projectUrl: 'https://github.com/orgs/override/projects/2',
        issueUrl: 'https://github.com/test/repo/issues/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Override QC',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });
    });

    it('should pass custom thresholdForAutoReject from config file', async () => {
      const configWithThreshold = {
        ...defaultConfig,
        thresholdForAutoReject: 5,
      };
      writeConfig(configWithThreshold);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholdForAutoReject: 5,
        }),
      );
    });

    it('should pass custom thresholdForAutoReject from CLI overriding config', async () => {
      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
        '--thresholdForAutoReject',
        '7',
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          thresholdForAutoReject: 7,
        }),
      );
    });

    it('should exit with error for invalid thresholdForAutoReject', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
          '--thresholdForAutoReject',
          'abc',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid value for --thresholdForAutoReject. It must be a positive integer.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when GH_TOKEN is missing', async () => {
      delete process.env.GH_TOKEN;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GH_TOKEN environment variable is required',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when projectUrl is missing', async () => {
      const configMissing = {
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'projectUrl is required. Provide via --projectUrl, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when preparationStatus is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        awaitingWorkspaceStatus: 'Awaiting',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'preparationStatus is required. Provide via --preparationStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingWorkspaceStatus is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        preparationStatus: 'Preparing',
        awaitingQualityCheckStatus: 'Awaiting QC',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingWorkspaceStatus is required. Provide via --awaitingWorkspaceStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should exit with error when awaitingQualityCheckStatus is missing', async () => {
      const configMissing = {
        projectUrl: 'https://github.com/orgs/test/projects/1',
        preparationStatus: 'Preparing',
        awaitingWorkspaceStatus: 'Awaiting',
      };
      writeConfig(configMissing);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => {
          throw new Error('process.exit called');
        });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notifyFinishedIssuePreparation',
          '--configFilePath',
          configFilePath,
          '--issueUrl',
          'https://github.com/test/repo/issues/1',
        ]),
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'awaitingQualityCheckStatus is required. Provide via --awaitingQualityCheckStatus, config file, or project README.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should pass workflowBlockerResolvedWebhookUrl from config file', async () => {
      const configWithWebhook = {
        ...defaultConfig,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?url={URL}',
      };
      writeConfig(configWithWebhook);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowBlockerResolvedWebhookUrl:
            'https://example.com/webhook?url={URL}',
        }),
      );
    });

    it('should apply README config overrides', async () => {
      const readmeContent = [
        '# Project',
        '<details>',
        '<summary>config</summary>',
        "awaitingQualityCheckStatus: 'README QC'",
        '</details>',
      ].join('\n');
      mockFetchReturningReadme(readmeContent);

      const mockRun = jest.fn().mockResolvedValue(undefined);
      const MockedNotifyFinishedUseCase = jest.mocked(
        NotifyFinishedIssuePreparationUseCase,
      );

      MockedNotifyFinishedUseCase.mockImplementation(function (
        this: NotifyFinishedIssuePreparationUseCase,
      ) {
        this.run = mockRun;
        return this;
      });

      await program.parseAsync([
        'node',
        'test',
        'notifyFinishedIssuePreparation',
        '--configFilePath',
        configFilePath,
        '--issueUrl',
        'https://github.com/test/repo/issues/1',
      ]);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          awaitingQualityCheckStatus: 'README QC',
        }),
      );
    });
  });
});
