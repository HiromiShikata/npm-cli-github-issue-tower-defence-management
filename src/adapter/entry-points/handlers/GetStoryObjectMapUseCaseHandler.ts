import YAML from 'yaml';
import fs from 'fs';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { SystemDateRepository } from '../../repositories/SystemDateRepository';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import { GetStoryObjectMapUseCase } from '../../../domain/usecases/GetStoryObjectMapUseCase';
import { StoryObjectMap } from '../../../domain/entities/StoryObjectMap';

export class GetStoryObjectMapUseCaseHandler {
  handle = async (
    configFilePath: string,
    _verbose: boolean,
  ): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    storyObjectMap: StoryObjectMap;
  }> => {
    const configFileContent = fs.readFileSync(configFilePath, 'utf8');
    const input: unknown = YAML.parse(configFileContent);
    type inputType = Parameters<GetStoryObjectMapUseCase['run']>[0] & {
      projectName: string;
      credentials: {
        bot: {
          github: {
            token: string;
          };
        };
      };
    };

    const isInputType = (v: unknown): v is inputType => {
      if (typeof v !== 'object' || v === null) return false;
      if (!('projectName' in v) || typeof v.projectName !== 'string')
        return false;
      if (
        !('credentials' in v) ||
        typeof v.credentials !== 'object' ||
        v.credentials === null
      )
        return false;
      const credentials = v.credentials;
      if (
        !('bot' in credentials) ||
        typeof credentials.bot !== 'object' ||
        credentials.bot === null
      )
        return false;
      const bot = credentials.bot;
      if (
        !('github' in bot) ||
        typeof bot.github !== 'object' ||
        bot.github === null
      )
        return false;
      const github = bot.github;
      if (!('token' in github) || typeof github.token !== 'string')
        return false;
      return true;
    };
    if (!isInputType(input)) {
      throw new Error(
        `Invalid input: required fields projectName and credentials.bot.github.token must be strings. Got: ${JSON.stringify(input)}`,
      );
    }
    const localStorageRepository = new LocalStorageRepository();
    const cachePath = `./tmp/cache/${input.projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
      cachePath,
    );
    const githubRepositoryParams: ConstructorParameters<
      typeof BaseGitHubRepository
    > = [localStorageRepository, input.credentials.bot.github.token];
    const projectRepository = {
      ...new GraphqlProjectRepository(
        ...githubRepositoryParams,
        localStorageCacheRepository,
      ),
    };
    const apiV3IssueRepository = new ApiV3IssueRepository(
      ...githubRepositoryParams,
    );
    const restIssueRepository = new RestIssueRepository(
      ...githubRepositoryParams,
    );
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository(
      ...githubRepositoryParams,
    );
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
      projectRepository,
      new SystemDateRepository(),
      ...githubRepositoryParams,
    );

    const getStoryObjectMapUseCase = new GetStoryObjectMapUseCase(
      projectRepository,
      issueRepository,
    );

    return await getStoryObjectMapUseCase.run(input);
  };
}
