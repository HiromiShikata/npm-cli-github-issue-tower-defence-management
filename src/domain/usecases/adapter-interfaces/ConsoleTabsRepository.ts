import {
  ConsoleListItem,
  ConsoleTabName,
} from '../console/GenerateConsoleListsUseCase';

export interface ConsoleTabsRepository {
  patchIssueTabTransition(params: {
    projectItemId: string;
    item: ConsoleListItem;
    targetTabName: ConsoleTabName | null;
  }): void;
}
