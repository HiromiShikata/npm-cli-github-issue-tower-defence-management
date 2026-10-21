import { Issue } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';

export type InTmuxByHumanUrlEntry = {
  url: string;
  title: string;
};

export type InTmuxByHumanGroupV1 = {
  story: string;
  urls: string[];
};

export type InTmuxByHumanGroupV2 = {
  story: string;
  urls: InTmuxByHumanUrlEntry[];
};

export type InTmuxByHumanSession = {
  name: string;
  description: string;
};

export type InTmuxByHumanGroupV4 = {
  story: string;
  sessions: InTmuxByHumanSession[];
};

export type InTmuxByHumanV3 = {
  version: 3;
  overviewUrl: string;
  tdpmConsoleUrl: string;
  groups: InTmuxByHumanGroupV2[];
};

export type InTmuxByHumanV4 = {
  version: 4;
  overviewUrl: string;
  tdpmConsoleUrl: string;
  newIssueUrl: string;
  groups: InTmuxByHumanGroupV4[];
};

export type InTmuxByHumanData = {
  v1: InTmuxByHumanGroupV1[];
  v2: InTmuxByHumanGroupV2[];
  v3: InTmuxByHumanV3 | null;
  v4: InTmuxByHumanV4 | null;
};

export type GenerateInTmuxByHumanDataInput = {
  project: Project;
  issues: Issue[];
  pjcode: string;
  assigneeLogin: string;
  org: string;
  repo: string;
  newIssueRepo?: string;
  consoleBaseUrl: string | null;
  consoleToken: string | null;
  now: Date;
};

type InTmuxByHumanStoryGroup = {
  story: string;
  issues: Issue[];
};

type InTmuxByHumanSortableStoryGroup = InTmuxByHumanStoryGroup & {
  sortIndex: number;
};

const IN_TMUX_BY_HUMAN_STATUS_NAME = 'In Tmux by human';
const UNKNOWN_STORY_SORT_INDEX = 999999;

export class GenerateInTmuxByHumanDataUseCase {
  run = (input: GenerateInTmuxByHumanDataInput): InTmuxByHumanData => {
    const {
      project,
      issues,
      pjcode,
      assigneeLogin,
      org,
      repo,
      newIssueRepo,
      consoleBaseUrl,
      consoleToken,
    } = input;

    const storyOptions: FieldOption[] = project.story
      ? project.story.stories
      : [];

    const selectedIssues = issues.filter((issue) =>
      this.isInTmuxByHuman(issue, assigneeLogin),
    );

    const groups = this.groupByStoryOrder(selectedIssues, storyOptions);

    const v2: InTmuxByHumanGroupV2[] = groups.map((group) => ({
      story: group.story,
      urls: group.issues.map((issue) => ({
        url: issue.url,
        title: issue.title,
      })),
    }));

    const v1: InTmuxByHumanGroupV1[] = groups.map((group) => ({
      story: group.story,
      urls: group.issues.map((issue) => issue.url),
    }));

    const v4Groups: InTmuxByHumanGroupV4[] = groups.map((group) => ({
      story: group.story,
      sessions: group.issues.map((issue) => ({
        name: issue.url,
        description: issue.title,
      })),
    }));

    const overviewUrl = project.url;
    const tdpmConsoleUrl = consoleBaseUrl
      ? `${consoleBaseUrl}/projects/${pjcode}`
      : null;

    const v3: InTmuxByHumanV3 | null = tdpmConsoleUrl
      ? {
          version: 3,
          overviewUrl,
          tdpmConsoleUrl,
          groups: v2,
        }
      : null;

    const v4: InTmuxByHumanV4 | null =
      tdpmConsoleUrl && consoleToken
        ? {
            version: 4,
            overviewUrl,
            tdpmConsoleUrl: `${tdpmConsoleUrl}?k=${consoleToken}`,
            newIssueUrl: `https://github.com/${org}/${newIssueRepo ?? repo}/issues/new?assignees=${assigneeLogin}`,
            groups: v4Groups,
          }
        : null;

    return { v1, v2, v3, v4 };
  };

  private isInTmuxByHuman = (issue: Issue, assigneeLogin: string): boolean =>
    issue.status === IN_TMUX_BY_HUMAN_STATUS_NAME &&
    issue.isClosed === false &&
    issue.assignees.includes(assigneeLogin) &&
    issue.dependedIssueUrls.length === 0 &&
    issue.nextActionDate === null &&
    issue.nextActionHour === null;

  private groupByStoryOrder = (
    issues: Issue[],
    storyOptions: FieldOption[],
  ): InTmuxByHumanStoryGroup[] => {
    const sortIndexByStoryOptionId = new Map(
      storyOptions.map((option, index) => [option.id, index]),
    );
    const sortIndexByStoryName = new Map(
      storyOptions.map((option, index) => [option.name, index]),
    );
    const groupsByStoryOptionId = new Map<
      string,
      InTmuxByHumanSortableStoryGroup
    >();
    const groupsByStoryNameOfIssuesWithoutStoryOptionId = new Map<
      string,
      InTmuxByHumanSortableStoryGroup
    >();
    for (const issue of issues) {
      const story = issue.story ?? '';
      const storyOptionId = issue.storyOptionId;
      const [groups, groupKey, sortIndex] =
        storyOptionId != null
          ? [
              groupsByStoryOptionId,
              storyOptionId,
              sortIndexByStoryOptionId.get(storyOptionId),
            ]
          : [
              groupsByStoryNameOfIssuesWithoutStoryOptionId,
              story,
              sortIndexByStoryName.get(story),
            ];
      const existing = groups.get(groupKey);
      if (existing) {
        existing.issues.push(issue);
      } else {
        groups.set(groupKey, {
          story,
          issues: [issue],
          sortIndex: sortIndex ?? UNKNOWN_STORY_SORT_INDEX,
        });
      }
    }
    return [
      ...groupsByStoryOptionId.values(),
      ...groupsByStoryNameOfIssuesWithoutStoryOptionId.values(),
    ]
      .sort((left, right) =>
        left.sortIndex !== right.sortIndex
          ? left.sortIndex - right.sortIndex
          : left.story < right.story
            ? -1
            : left.story > right.story
              ? 1
              : 0,
      )
      .map(({ story, issues: groupedIssues }) => ({
        story,
        issues: groupedIssues,
      }));
  };
}
