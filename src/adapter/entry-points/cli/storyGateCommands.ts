import fs from 'node:fs';
import path from 'node:path';
import { GithubIssueReference } from '../../../domain/usecases/adapter-interfaces/StoryGateIssueRepository';
import { githubIssueReferenceParse } from '../../../domain/usecases/storyGate/githubIssueReferenceParse';
import { IssueStorySetIfUnsetUseCase } from '../../../domain/usecases/storyGate/IssueStorySetIfUnsetUseCase';
import { SpecificationTaskStartUseCase } from '../../../domain/usecases/storyGate/SpecificationTaskStartUseCase';
import {
  STORY_GATE_RESULT_FILE_NAME,
  StoryGateCheckUseCase,
} from '../../../domain/usecases/storyGate/StoryGateCheckUseCase';
import { GithubStoryGateIssueRepository } from '../../repositories/GithubStoryGateIssueRepository';
import { localStorageCacheBaseDirectory } from '../../repositories/localStorageCacheDirectory';
import { LocalStorageStoryGateBoardCacheRepository } from '../../repositories/LocalStorageStoryGateBoardCacheRepository';
import { YamlStoryGateProjectConfigRepository } from '../../repositories/YamlStoryGateProjectConfigRepository';

export type StoryGateCommandOutput = {
  stdout: string | null;
  stderr: string | null;
  exitCode: 0 | 2;
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
  boardCacheBaseDirectory?: string;
};

export type SetIssueStoryIfUnsetInput = {
  issueUrl: string;
  story: string;
  dryRun: boolean;
  ghToken: string | undefined;
};

export type StartSpecificationTaskInput = {
  issueUrl: string;
  specificationAgentName: string;
  dryRun: boolean;
  ghToken: string | undefined;
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

export const checkStoryGate = async (
  input: CheckStoryGateInput,
): Promise<StoryGateCommandOutput> => {
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  const useCase = new StoryGateCheckUseCase(
    new GithubStoryGateIssueRepository(validated.ghToken),
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
    return failure(
      `checkStoryGate failed for ${input.issueUrl}: ${errorMessageOf(error)}`,
    );
  }
};

export const setIssueStoryIfUnset = async (
  input: SetIssueStoryIfUnsetInput,
): Promise<StoryGateCommandOutput> => {
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  try {
    const result = await new IssueStorySetIfUnsetUseCase(
      new GithubStoryGateIssueRepository(validated.ghToken),
    ).run({
      issue: validated.issue,
      storyName: input.story,
      dryRun: input.dryRun,
    });
    return { stdout: JSON.stringify(result), stderr: null, exitCode: 0 };
  } catch (error) {
    return failure(
      `setIssueStoryIfUnset failed for ${input.issueUrl}: ${errorMessageOf(error)}`,
    );
  }
};

export const startSpecificationTask = async (
  input: StartSpecificationTaskInput,
): Promise<StoryGateCommandOutput> => {
  const validated = commandInputValidate(input.issueUrl, input.ghToken);
  if ('failure' in validated) {
    return validated.failure;
  }
  try {
    const result = await new SpecificationTaskStartUseCase(
      new GithubStoryGateIssueRepository(validated.ghToken),
    ).run({
      issue: validated.issue,
      specificationAgentName: input.specificationAgentName,
      dryRun: input.dryRun,
    });
    return { stdout: JSON.stringify(result), stderr: null, exitCode: 0 };
  } catch (error) {
    return failure(
      `startSpecificationTask failed for ${input.issueUrl}: ${errorMessageOf(error)}`,
    );
  }
};
