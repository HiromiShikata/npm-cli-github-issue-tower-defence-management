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

    const inputRecord = input as Record<string, unknown>;
    const credentialsRecord = inputRecord?.['credentials'] as Record<string, unknown> | undefined;
    const botRecord = credentialsRecord?.['bot'] as Record<string, unknown> | undefined;
    const githubRecord = botRecord?.['github'] as Record<string, unknown> | undefined;
    if (
      typeof inputRecord?.['projectName'] !== 'string' ||
      typeof githubRecord?.['token'] !== 'string'
    ) {
      throw new Error(
        `Invalid input: required fields projectName and credentials.bot.github.token must be strings. Got: ${JSON.stringify(input)}`,
      );
    }
    const typedInput = input as inputType;
    const localStorageRepository = new LocalStorageRepository();
    const cachePath = `./tmp/cache/${typedInput.projectName}`;
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
      cachePath,
    );
    const githubRepositoryParams: ConstructorParameters<
      typeof BaseGitHubRepository
    > = [localStorageRepository, typedInput.credentials.bot.github.token];
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

    return await getStoryObjectMapUseCase.run(typedInput);
  };
}
