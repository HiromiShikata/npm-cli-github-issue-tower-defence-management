import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  GithubIssueReference,
  StoryGateGithubRateLimitError,
} from '../../../domain/usecases/adapter-interfaces/StoryGateIssueRepository';
import { githubIssueReferenceParse } from '../../../domain/usecases/storyGate/githubIssueReferenceParse';
import { IssueStorySetIfUnsetUseCase } from '../../../domain/usecases/storyGate/IssueStorySetIfUnsetUseCase';
import { SpecificationTaskStartUseCase } from '../../../domain/usecases/storyGate/SpecificationTaskStartUseCase';
import {
  STORY_GATE_RESULT_FILE_NAME,
  StoryGateCheckUseCase,
} from '../../../domain/usecases/storyGate/StoryGateCheckUseCase';
import {
  GithubStoryGateIssueRepository,
  GithubTokenSource,
} from '../../repositories/GithubStoryGateIssueRepository';
import { localStorageCacheBaseDirectory } from '../../repositories/localStorageCacheDirectory';
import { LocalStorageStoryGateBoardCacheRepository } from '../../repositories/LocalStorageStoryGateBoardCacheRepository';
import { YamlStoryGateProjectConfigRepository } from '../../repositories/YamlStoryGateProjectConfigRepository';
import {
  createConsoleGithubTokenResolver,
  createConsoleGithubTokenResolverByItemUrl,
} from '../console/consoleGithubTokenResolver';
import { ConfigFile, loadConfigFile } from './projectConfig';

export type StoryGateCommandOutput = {
  stdout: string | null;
  stderr: string | null;
  exitCode: 0 | 2 | 3;
};

export type CheckStoryGateInput = {
  issueUrl: string;
  agentName: string;
  triageAgentName: string;
  specificationAgentName: string;
  configDirectory: string;
  outputDirectory: string;
  dryRun: boolean;
  ghToken: string | undefined;
  configFilePath?: string;
  boardCacheBaseDirectory?: string;
};

export type SetIssueStoryIfUnsetInput = {
  issueUrl: string;
  story: string;
  dryRun: boolean;
  ghToken: string | undefined;
  configFilePath?: string;
};

export type StartSpecificationTaskInput = {
  issueUrl: string;
  specificationAgentName: string;
  dryRun: boolean;
  ghToken: string | undefined;
  configFilePath?: string;
};

const GH_TOKEN_MISSING_MESSAGE =
  'GH_TOKEN environment variable is required. For an issue in another organization, run the command with that organization token in GH_TOKEN.';

const failure = (message: string): StoryGateCommandOutput => ({
  stdout: null,
  stderr: message,
  exitCode: 2,
});

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const commandFailureOf = (
  commandName: string,
  issueUrl: string,
  error: unknown,
): StoryGateCommandOutput => {
  const message = `${commandName} failed for ${issueUrl}: ${errorMessageOf(error)}`;
  if (error instanceof StoryGateGithubRateLimitError) {
    return {
      stdout: null,
      stderr: `${message}\n${JSON.stringify({ rateLimited: true, resetAt: error.resetAt })}`,
      exitCode: 3,
    };
  }
  return failure(message);
};

const commandInputValidate = (
  issueUrl: string,
  ghToken: string | undefined,
):
  | { issue: GithubIssueReference; ghToken: string }
  | { failure: StoryGateCommandOutput } => {
  if (ghToken === undefined || ghToken === '') {
    return { failure: failure(GH_TOKEN_MISSING_MESSAGE) };
  }
  const issue = githubIssueReferenceParse(issueUrl);
  if (issue === null) {
    return {
      failure: failure(
        `Invalid GitHub issue URL: ${issueUrl}. Expected https://github.com/{owner}/{repo}/issues/{number}.`,
      ),
    };
  }
  return { issue, ghToken };
};

const malformedConfigFileMessageOf = (
  configFilePath: string,
): string | undefined => {
  let content: string;
  try {
    content = fs.readFileSync(configFilePath, 'utf-8');
  } catch {
    return undefined;
  }
  try {
    YAML.parse(content, { logLevel: 'error' });
    return undefined;
  } catch (error) {
    if (!(error instanceof YAML.YAMLParseError)) {
      return undefined;
    }
    const start = error.linePos?.[0];
    return `Failed to load configuration file "${configFilePath}": malformed YAML at line ${start?.line}, column ${start?.col}`;
  }
};

const consoleConfigOf = (
  configFilePath: string | undefined,
): ConfigFile | undefined => {
  if (configFilePath === undefined) {
    return undefined;
  }
  const malformedMessage = malformedConfigFileMessageOf(configFilePath);
  if (malformedMessage !== undefined) {
    console.error(malformedMessage);
    process.exit(1);
  }
  return loadConfigFile(configFilePath);
};

const githubTokenSourceOf = (
  ghToken: string,
  consoleConfig: ConfigFile | undefined,
): GithubTokenSource => {
  if (consoleConfig === undefined) {
    return ghToken;
  }
  return createConsoleGithubTokenResolverByItemUrl(
    createConsoleGithubTokenResolver(
      ghToken,
      consoleConfig.consoleProjects ?? null,
      consoleConfig.consoleGithubTokens ?? null,
    ),
  );
};

export const checkStoryGate = async (
  input: CheckStoryGateInput,
): Promise<StoryGateCommandOutput> => {
  const consoleConfig = consoleConfigOf(input.configFilePath);
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  const useCase = new StoryGateCheckUseCase(
    new GithubStoryGateIssueRepository(
      githubTokenSourceOf(validated.ghToken, consoleConfig),
    ),
    new LocalStorageStoryGateBoardCacheRepository(
      input.boardCacheBaseDirectory ?? localStorageCacheBaseDirectory(),
    ),
    new YamlStoryGateProjectConfigRepository(input.configDirectory),
  );
  try {
    const outputDirectory = path.resolve(input.outputDirectory);
    const { result, outputFiles } = await useCase.run({
      issue: validated.issue,
      agentName: input.agentName,
      triageAgentName: input.triageAgentName,
      specificationAgentName: input.specificationAgentName,
      outputDirectory,
      dryRun: input.dryRun,
    });
    const resultJson = JSON.stringify(result);
    await fs.promises.mkdir(outputDirectory, { recursive: true });
    for (const outputFile of outputFiles) {
      await fs.promises.writeFile(outputFile.path, outputFile.content, 'utf8');
    }
    await fs.promises.writeFile(
      path.join(outputDirectory, STORY_GATE_RESULT_FILE_NAME),
      `${resultJson}\n`,
      'utf8',
    );
    return { stdout: resultJson, stderr: null, exitCode: 0 };
  } catch (error) {
    return commandFailureOf('checkStoryGate', input.issueUrl, error);
  }
};

export const setIssueStoryIfUnset = async (
  input: SetIssueStoryIfUnsetInput,
): Promise<StoryGateCommandOutput> => {
  const consoleConfig = consoleConfigOf(input.configFilePath);
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  try {
    const result = await new IssueStorySetIfUnsetUseCase(
      new GithubStoryGateIssueRepository(
        githubTokenSourceOf(validated.ghToken, consoleConfig),
      ),
    ).run({
      issue: validated.issue,
      storyName: input.story,
      dryRun: input.dryRun,
    });
    return { stdout: JSON.stringify(result), stderr: null, exitCode: 0 };
  } catch (error) {
    return commandFailureOf('setIssueStoryIfUnset', input.issueUrl, error);
  }
};

export const startSpecificationTask = async (
  input: StartSpecificationTaskInput,
): Promise<StoryGateCommandOutput> => {
  const consoleConfig = consoleConfigOf(input.configFilePath);
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  try {
    const result = await new SpecificationTaskStartUseCase(
      new GithubStoryGateIssueRepository(
        githubTokenSourceOf(validated.ghToken, consoleConfig),
      ),
    ).run({
      issue: validated.issue,
      specificationAgentName: input.specificationAgentName,
      dryRun: input.dryRun,
    });
    return { stdout: JSON.stringify(result), stderr: null, exitCode: 0 };
  } catch (error) {
    return commandFailureOf('startSpecificationTask', input.issueUrl, error);
  }
};
