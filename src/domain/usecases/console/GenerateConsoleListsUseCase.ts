import { Issue } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
import {
  IN_TMUX_BY_AGENT_STATUS_NAME,
  LEGACY_TODO_STATUS_NAME,
  TODO_STATUS_NAME,
} from '../../entities/WorkflowStatus';

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
  storyColors: Record<string, { color: ConsoleColor }>;
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

export type ConsoleTabName =
  | 'workflow-blocker'
  | 'prs'
  | 'triage'
  | 'unread'
  | 'failed-preparation'
  | 'todo-by-human';

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

const UNKNOWN_STORY_SORT_INDEX = 999999;

export class GenerateConsoleListsUseCase {
  run = (input: GenerateConsoleListsInput): ConsoleLists => {
    const {
      project,
      issues,
      pjcode,
      assigneeLogin,
      generatedAt,
      workflowBlockerStoryName,
    } = input;

    const storyOptions = project.story ? project.story.stories : [];
    const storyOrder = storyOptions.map((option) => option.name);
    const statusOptions = project.status.statuses;

    const actionableIssues = issues.filter((issue) =>
      this.isActionable(issue, assigneeLogin),
    );

    const buildStatusTabFromSource = (
      sourceIssues: Issue[],
      selector: (issue: Issue) => boolean,
      excludedStatusNames: string[],
    ): ConsoleStatusTab => ({
      pjcode,
      generatedAt,
      statusOptions: this.buildFieldOptions(statusOptions, excludedStatusNames),
      storyOrder,
      storyColors: this.buildStoryColorsObject(storyOptions),
      items: this.sortByStoryOrder(
        sourceIssues.filter(selector).map((issue) => this.projectItem(issue)),
        storyOrder,
      ),
    });

    const buildStatusTab = (
      selector: (issue: Issue) => boolean,
      excludedStatusNames: string[],
    ): ConsoleStatusTab =>
      buildStatusTabFromSource(actionableIssues, selector, excludedStatusNames);

    return {
      'workflow-blocker': buildStatusTabFromSource(
        issues.filter((issue) => issue.isClosed === false),
        this.workflowBlockerSelector(workflowBlockerStoryName),
        ['done'],
      ),
      prs: buildStatusTab(
        (issue) =>
          issue.status !== null &&
          issue.status.toLowerCase() === 'awaiting quality check',
        ['awaiting quality check', 'done'],
      ),
      unread: buildStatusTab(
        (issue) =>
          issue.status !== null && issue.status.toLowerCase() === 'unread',
        ['unread', 'done'],
      ),
      'failed-preparation': buildStatusTab(
        (issue) => issue.status === 'Failed Preparation',
        [
          'failed preparation',
          'done',
          'preparation',
          'icebox',
          'unread',
          'in tmux by human',
          'in tmux by agent',
        ],
      ),
      'todo-by-human': buildStatusTab(
        (issue) =>
          issue.status === TODO_STATUS_NAME ||
          issue.status === LEGACY_TODO_STATUS_NAME,
        [TODO_STATUS_NAME.toLowerCase(), 'done'],
      ),
      triage: {
        pjcode,
        generatedAt,
        storyOptions: this.buildFieldOptions(storyOptions, []),
        storyOrder,
        storyColors: this.buildStoryColorsString(storyOptions),
        items: this.sortByStoryOrder(
          actionableIssues
            .filter(
              (issue) =>
                issue.story !== null &&
                issue.story.toLowerCase().includes('no story') &&
                issue.status?.toLowerCase() !==
                  IN_TMUX_BY_AGENT_STATUS_NAME.toLowerCase(),
            )
            .map((issue) => this.projectItem(issue)),
          storyOrder,
        ),
      },
    };
  };

  private isActionable = (issue: Issue, assigneeLogin: string): boolean =>
    issue.isClosed === false &&
    issue.assignees.includes(assigneeLogin) &&
    issue.dependedIssueUrls.length === 0 &&
    issue.nextActionDate === null &&
    issue.nextActionHour === null;

  private workflowBlockerSelector = (
    workflowBlockerStoryName: string | null,
  ): ((issue: Issue) => boolean) => {
    const target = workflowBlockerStoryName?.toLowerCase() ?? '';
    if (target === '') {
      return () => false;
    }
    return (issue: Issue): boolean =>
      issue.story !== null && issue.story.toLowerCase() === target;
  };

  private projectItem = (issue: Issue): ConsoleListItem => ({
    number: issue.number,
    title: issue.title,
    url: issue.url,
    repo: issue.nameWithOwner,
    nameWithOwner: issue.nameWithOwner,
    projectItemId: issue.itemId,
    itemId: issue.itemId,
    isPr: issue.isPr,
    story: issue.story ?? '',
    status: issue.status,
    nextActionDate:
      issue.nextActionDate === null ? null : issue.nextActionDate.toISOString(),
    nextActionHour: issue.nextActionHour,
    dependedIssueUrls: issue.dependedIssueUrls,
    labels: issue.labels,
    createdAt: issue.createdAt.toISOString(),
  });

  private buildFieldOptions = (
    options: FieldOption[],
    excludedLowerCaseNames: string[],
  ): ConsoleFieldOption[] =>
    options
      .filter(
        (option) => !excludedLowerCaseNames.includes(option.name.toLowerCase()),
      )
      .map((option) => ({
        id: option.id,
        name: option.name,
        color: option.color,
      }));

  private buildStoryColorsObject = (
    options: FieldOption[],
  ): Record<string, { color: ConsoleColor }> => {
    const result: Record<string, { color: ConsoleColor }> = {};
    for (const option of options) {
      result[option.name] = { color: option.color };
    }
    return result;
  };

  private buildStoryColorsString = (
    options: FieldOption[],
  ): Record<string, ConsoleColor> => {
    const result: Record<string, ConsoleColor> = {};
    for (const option of options) {
      result[option.name] = option.color;
    }
    return result;
  };

  private sortByStoryOrder = (
    items: ConsoleListItem[],
    storyOrder: string[],
  ): ConsoleListItem[] => {
    const indexByStory = new Map(
      storyOrder.map((name, index) => [name, index]),
    );
    return items
      .map((item, position) => ({
        item,
        position,
        sortKey: indexByStory.get(item.story) ?? UNKNOWN_STORY_SORT_INDEX,
      }))
      .sort((a, b) => a.sortKey - b.sortKey || a.position - b.position)
      .map((entry) => entry.item);
  };
}
