import { Issue } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
export type ConsoleColor = FieldOption['color'];
export type ConsoleListItem = {
    number: number;
    title: string;
    url: string;
    repo: string;
    nameWithOwner: string;
    projectItemId: string;
    itemId: string;
    isPr: boolean;
    story: string;
    status: string | null;
    nextActionDate: string | null;
    nextActionHour: number | null;
    dependedIssueUrls: string[];
    labels: string[];
    createdAt: string;
};
export type ConsoleFieldOption = {
    id: string;
    name: string;
    color: ConsoleColor;
};
export type ConsoleStatusTab = {
    pjcode: string;
    generatedAt: string;
    statusOptions: ConsoleFieldOption[];
    storyOrder: string[];
    storyColors: Record<string, {
        color: ConsoleColor;
    }>;
    items: ConsoleListItem[];
};
export type ConsoleTriageTab = {
    pjcode: string;
    generatedAt: string;
    storyOptions: ConsoleFieldOption[];
    storyOrder: string[];
    storyColors: Record<string, ConsoleColor>;
    items: ConsoleListItem[];
};
export type ConsoleTabName = 'workflow-blocker' | 'prs' | 'triage' | 'unread' | 'failed-preparation' | 'todo-by-human';
export type ConsoleLists = {
    'workflow-blocker': ConsoleStatusTab;
    prs: ConsoleStatusTab;
    triage: ConsoleTriageTab;
    unread: ConsoleStatusTab;
    'failed-preparation': ConsoleStatusTab;
    'todo-by-human': ConsoleStatusTab;
};
export type GenerateConsoleListsInput = {
    project: Project;
    issues: Issue[];
    pjcode: string;
    assigneeLogin: string;
    generatedAt: string;
    workflowBlockerStoryName: string | null;
};
export declare class GenerateConsoleListsUseCase {
    run: (input: GenerateConsoleListsInput) => ConsoleLists;
    private isActionable;
    private workflowBlockerSelector;
    private projectItem;
    private buildFieldOptions;
    private buildStoryColorsObject;
    private buildStoryColorsString;
    private sortByStoryOrder;
}
//# sourceMappingURL=GenerateConsoleListsUseCase.d.ts.map