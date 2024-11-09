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
    const projectRepository = new GraphqlProjectRepository();
    const apiV3IssueRepository = new ApiV3IssueRepository();
    const cheerioIssueRepository = new CheerioIssueRepository();
    const restIssueRepository = new RestIssueRepository();
    const graphqlProjectItemRepository = new GraphqlProjectItemRepository();
    const issueRepository = new ApiV3CheerioRestIssueRepository(
      apiV3IssueRepository,
      cheerioIssueRepository,
      restIssueRepository,
      graphqlProjectItemRepository,
    );
    const generateWorkingTimeReportUseCase =
      new GenerateWorkingTimeReportUseCase(issueRepository);
    const handleScheduledEventUseCase = new HandleScheduledEventUseCase(
      generateWorkingTimeReportUseCase,
      systemDateRepository,
      googleSpreadsheetRepository,
      projectRepository,
      issueRepository,
    );

    await handleScheduledEventUseCase.run(input);
  };
}
