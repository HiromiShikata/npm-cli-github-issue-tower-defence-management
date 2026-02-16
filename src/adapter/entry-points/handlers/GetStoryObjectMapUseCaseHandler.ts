import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import axios, { AxiosError } from 'axios';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import {
  GetStoryObjectMapUseCase,
  StoryObjectMap,
} from '../../../domain/usecases/GetStoryObjectMapUseCase';

export class GetStoryObjectMapUseCaseHandler {
  handle = async (
    configFilePath: string,
    verbose: boolean,
    allowCacheMinutes?: number,
  ): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    storyObjectMap: StoryObjectMap;
  }> => {
    axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (verbose) {
          throw new Error(`API Error: ${JSON.stringify(error)}`);
        }
        if (error.response) {
          throw new Error(`API Error: ${error.response.status}`);
        }
        throw new Error('Network Error');
      },
    );

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

    if (!TYPIA.is<inputType>(input)) {
      throw new Error(
        `Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify(TYPIA.validate<inputType>(input))}`,
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
    > = [
      localStorageRepository,
      `${cachePath}/github.com.cookies.json`,
      input.credentials.bot.github.token,
    ];
    const projectRepository = {
      ...new GraphqlProjectRepository(...githubRepositoryParams),
      ...new CheerioProjectRepository(...githubRepositoryParams),
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
      ...githubRepositoryParams,
    );

    const getStoryObjectMapUseCase = new GetStoryObjectMapUseCase(
      projectRepository,
      issueRepository,
    );

    const useCaseInput =
      allowCacheMinutes !== undefined
        ? { ...input, allowIssueCacheMinutes: allowCacheMinutes }
        : input;

    return await getStoryObjectMapUseCase.run(useCaseInput);
  };
}
