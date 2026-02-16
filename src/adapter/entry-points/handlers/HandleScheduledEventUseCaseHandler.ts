import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { SystemDateRepository } from '../../repositories/SystemDateRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GoogleSpreadsheetRepository } from '../../repositories/GoogleSpreadsheetRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { HandleScheduledEventUseCase } from '../../../domain/usecases/HandleScheduledEventUseCase';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { ActionAnnouncementUseCase } from '../../../domain/usecases/ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from '../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase';
import { ClearNextActionHourUseCase } from '../../../domain/usecases/ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from '../../../domain/usecases/AnalyzeProblemByIssueUseCase';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { BaseGitHubRepository } from '../../repositories/BaseGitHubRepository';
import { AnalyzeStoriesUseCase } from '../../../domain/usecases/AnalyzeStoriesUseCase';
import { ClearDependedIssueURLUseCase } from '../../../domain/usecases/ClearDependedIssueURLUseCase';
import { CreateEstimationIssueUseCase } from '../../../domain/usecases/CreateEstimationIssueUseCase';
import axios, { AxiosError } from 'axios';
import { ConvertCheckboxToIssueInStoryIssueUseCase } from '../../../domain/usecases/ConvertCheckboxToIssueInStoryIssueUseCase';
import { ChangeStatusByStoryColorUseCase } from '../../../domain/usecases/ChangeStatusByStoryColorUseCase';
import { SetNoStoryIssueToStoryUseCase } from '../../../domain/usecases/SetNoStoryIssueToStoryUseCase';
import { CreateNewStoryByLabelUseCase } from '../../../domain/usecases/CreateNewStoryByLabelUseCase';
import { CheerioProjectRepository } from '../../repositories/CheerioProjectRepository';
import { AssignNoAssigneeIssueToManagerUseCase } from '../../../domain/usecases/AssignNoAssigneeIssueToManagerUseCase';
import { UpdateIssueStatusByLabelUseCase } from '../../../domain/usecases/UpdateIssueStatusByLabelUseCase';

export class HandleScheduledEventUseCaseHandler {
  handle = async (
    configFilePath: string,
    verbose: boolean,
  ): Promise<{
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    targetDateTimes: Date[];
  } | null> => {
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
    type inputType = Parameters<HandleScheduledEventUseCase['run']>[0] & {
      credentials: {
        manager: {
          github: {
            token: string;
          };
          slack: {
            userToken: string;
          };
          googleServiceAccount: {
            serviceAccountKey: string;
          };
        };
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
    if (input.disabled) {
      return null;
    }
    const systemDateRepository = new SystemDateRepository();
    const localStorageRepository = new LocalStorageRepository();
    const googleSpreadsheetRepository = new GoogleSpreadsheetRepository(
      localStorageRepository,
      input.credentials.manager.googleServiceAccount.serviceAccountKey,
    );
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
    const actionAnnouncement = new ActionAnnouncementUseCase(issueRepository);
    const setWorkflowManagementIssueToStoryUseCase =
      new SetWorkflowManagementIssueToStoryUseCase(issueRepository);
    const clearNextActionHourUseCase = new ClearNextActionHourUseCase(
      issueRepository,
    );
    const analyzeProblemByIssueUseCase = new AnalyzeProblemByIssueUseCase(
      issueRepository,
      systemDateRepository,
    );
    const analyzeStoriesUseCase = new AnalyzeStoriesUseCase(
      issueRepository,
      systemDateRepository,
    );
    const clearDependedIssueURLUseCase = new ClearDependedIssueURLUseCase(
      issueRepository,
    );
    const createEstimationIssueUseCase = new CreateEstimationIssueUseCase(
      issueRepository,
      systemDateRepository,
    );
    const convertCheckboxToIssueInStoryIssueUseCase =
      new ConvertCheckboxToIssueInStoryIssueUseCase(issueRepository);
    const changeStatusByStoryColorUseCase = new ChangeStatusByStoryColorUseCase(
      systemDateRepository,
      issueRepository,
    );

    const setNoStoryIssueToStoryUseCase = new SetNoStoryIssueToStoryUseCase(
      issueRepository,
    );
    const createNewStoryByLabel = new CreateNewStoryByLabelUseCase(
      projectRepository,
      issueRepository,
    );
    const assignNoAssigneeIssueToManagerUseCase =
      new AssignNoAssigneeIssueToManagerUseCase(issueRepository);
    const updateIssueStatusByLabelUseCase = new UpdateIssueStatusByLabelUseCase(
      issueRepository,
    );

    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      actionAnnouncement,
      setWorkflowManagementIssueToStoryUseCase,
      clearNextActionHourUseCase,
      analyzeProblemByIssueUseCase,
      analyzeStoriesUseCase,
      clearDependedIssueURLUseCase,
      createEstimationIssueUseCase,
      convertCheckboxToIssueInStoryIssueUseCase,
      changeStatusByStoryColorUseCase,
      setNoStoryIssueToStoryUseCase,
      createNewStoryByLabel,
      assignNoAssigneeIssueToManagerUseCase,
      updateIssueStatusByLabelUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    return await handleScheduledEventUseCase.run(input);
  };
}
