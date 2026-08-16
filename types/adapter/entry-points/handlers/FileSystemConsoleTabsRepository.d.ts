import type { ConsoleListItem, ConsoleTabName } from '../../../domain/usecases/console/GenerateConsoleListsUseCase';
import type { ConsoleTabsRepository } from '../../../domain/usecases/adapter-interfaces/ConsoleTabsRepository';
export declare class FileSystemConsoleTabsRepository implements ConsoleTabsRepository {
    private readonly consoleDataOutputDir;
    private readonly pjcode;
    constructor(consoleDataOutputDir: string, pjcode: string);
    patchIssueTabTransition(params: {
        projectItemId: string;
        item: ConsoleListItem;
        targetTabName: ConsoleTabName | null;
    }): void;
}
//# sourceMappingURL=FileSystemConsoleTabsRepository.d.ts.map