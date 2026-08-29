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
    agent: string | null;
    nextActionDate: string | null;
    nextActionHour: number | null;
    dependedIssueUrls: string[];
    labels: string[];
    createdAt: string;
    relatedOpenPullRequestUrls: string[];
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
export type ConsoleTabName = 'workflow-blocker' | 'prs' | 'failed-preparation' | 'todo-by-human' | 'todo-by-agent' | 'stories';
export type ConsoleStoryEntry = {
    storyName: string;
    storyOptionId: string;
    color: ConsoleColor;
    openItemCount: number;
    storyViewUrl: string | null;
};
export type ConsoleStoriesTab = {
    pjcode: string;
    generatedAt: string;
    stories: ConsoleStoryEntry[];
    storyOrder: string[];
    storyColors: Record<string, {
        color: ConsoleColor;
    }>;
    defaultNameWithOwner: string | null;
};
export type ConsoleLists = {
    'workflow-blocker': ConsoleStatusTab;
    prs: ConsoleStatusTab;
    'failed-preparation': ConsoleStatusTab;
    'todo-by-human': ConsoleStatusTab;
    'todo-by-agent': ConsoleStatusTab;
    stories: ConsoleStoriesTab;
};
export type GenerateConsoleListsInput = {
    project: Project;
    issues: Issue[];
    pjcode: string;
    assigneeLogin: string;
    generatedAt: string;
    workflowBlockerStoryName: string | null;
    urlOfStoryView: string | null;
};
export declare class GenerateConsoleListsUseCase {
    run: (input: GenerateConsoleListsInput) => ConsoleLists;
    private isActionable;
    private workflowBlockerSelector;
    private buildRelatedOpenPullRequestUrlsByIssueUrl;
    private projectItem;
    private buildFieldOptions;
    private buildStoryColorsObject;
    private sortByStoryOrder;
}
//# sourceMappingURL=GenerateConsoleListsUseCase.d.ts.map