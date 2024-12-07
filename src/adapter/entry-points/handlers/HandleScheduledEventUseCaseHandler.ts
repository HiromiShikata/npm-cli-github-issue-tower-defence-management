import YAML from 'yaml';
import TYPIA from 'typia';
import fs from 'fs';
import { SystemDateRepository } from '../../repositories/SystemDateRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { GoogleSpreadsheetRepository } from '../../repositories/GoogleSpreadsheetRepository';
import { GraphqlProjectRepository } from '../../repositories/GraphqlProjectRepository';
import { ApiV3IssueRepository } from '../../repositories/issue/ApiV3IssueRepository';
import { CheerioIssueRepository } from '../../repositories/issue/CheerioIssueRepository';
import { RestIssueRepository } from '../../repositories/issue/RestIssueRepository';
import { GraphqlProjectItemRepository } from '../../repositories/issue/GraphqlProjectItemRepository';
import { ApiV3CheerioRestIssueRepository } from '../../repositories/issue/ApiV3CheerioRestIssueRepository';
import { GenerateWorkingTimeReportUseCase } from '../../../domain/usecases/GenerateWorkingTimeReportUseCase';
import { HandleScheduledEventUseCase } from '../../../domain/usecases/HandleScheduledEventUseCase';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { ActionAnnouncementUseCase } from '../../../domain/usecases/ActionAnnouncementUseCase';
import { SetWorkflowManagementIssueToStoryUseCase } from '../../../domain/usecases/SetWorkflowManagementIssueToStoryUseCase';
import { InternalGraphqlIssueRepository } from '../../repositories/issue/InternalGraphqlIssueRepository';
import { ClearNextActionHourUseCase } from '../../../domain/usecases/ClearNextActionHourUseCase';
import { AnalyzeProblemByIssueUseCase } from '../../../domain/usecases/AnalyzeProblemByIssueUseCase';

export class HandleScheduledEventUseCaseHandler {
  handle = async (configFilePath: string): Promise<void> => {
    const configFileContent = fs.readFileSync(configFilePath, 'utf8');
    const input: unknown = YAML.parse(configFileContent);
    type inputType = Parameters<HandleScheduledEventUseCase['run']>[0];
    if (!TYPIA.is<inputType>(input)) {
      throw new Error(
        `Invalid input: ${JSON.stringify(input)}\n\n${JSON.stringify(TYPIA.validate<inputType>(input))}`,
      );
    }

    const systemDateRepository = new SystemDateRepository();
    const localStorageRepository = new LocalStorageRepository();
    const googleSpreadsheetRepository = new GoogleSpreadsheetRepository(
      localStorageRepository,
    );
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      localStorageRepository,
    );
    const projectRepository = new GraphqlProjectRepository();
    const apiV3IssueRepository = new ApiV3IssueRepository();
    const internalGraphqlIssueRepository = new InternalGraphqlIssueRepository();
    const cheerioIssueRepository = new CheerioIssueRepository(
      internalGraphqlIssueRepository,
    );
    const restIssueRepository = new RestIssueRepository();
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository();
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      cheerioIssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
      localStorageCacheRepository,
    );
    const generateWorkingTimeReportUseCase =
      new GenerateWorkingTimeReportUseCase(
        issueRepository,
        googleSpreadsheetRepository,
        systemDateRepository,
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
    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      generateWorkingTimeReportUseCase,
      actionAnnouncement,
      setWorkflowManagementIssueToStoryUseCase,
      clearNextActionHourUseCase,
      analyzeProblemByIssueUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    await handleScheduledEventUseCase.run(input);
  };
}
