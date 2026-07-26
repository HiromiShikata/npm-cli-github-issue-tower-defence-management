import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class SetWorkflowManagementIssueToStoryUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'updateStory' | 'removeLabel' | 'searchIssue' | 'createNewIssue'
    >,
  ) {}

  static readonly STORY_LABEL_PREFIX = 'story:';
  static readonly WORKFLOW_MANAGEMENT_LABEL = 'story:workflow-management';
  static readonly DAILY_ROUTINE_LABEL = 'daily-routine';
  static readonly REGULAR_STORY_PREFIX = 'regular / ';

  static normalizeCandidate = (candidate: string): string =>
    candidate.toLowerCase().replace(/[\s/_-]/g, '');

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
  }): Promise<void> => {
    const story = input.project.story;
    if (!story) {
      return;
    }
    for (const issue of input.issues) {
      if (!this.isEligibleIssue(issue, input.targetDates)) {
        continue;
      }

      const isWorkflowManagementIssue =
        issue.labels.includes(
          SetWorkflowManagementIssueToStoryUseCase.WORKFLOW_MANAGEMENT_LABEL,
        ) ||
        issue.labels.includes(
          SetWorkflowManagementIssueToStoryUseCase.DAILY_ROUTINE_LABEL,
        ) ||
        issue.isPr;

      if (isWorkflowManagementIssue) {
        await this.issueRepository.updateStory(
          { ...input.project, story },
          issue,
          story.workflowManagementStory.id,
        );
        const workflowLabel = issue.labels.find(
          (label) =>
            label.toLowerCase() ===
            SetWorkflowManagementIssueToStoryUseCase.WORKFLOW_MANAGEMENT_LABEL,
        );
        if (workflowLabel) {
          await this.issueRepository.removeLabel(issue, workflowLabel);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const storyLabel = issue.labels.find((label) =>
        label
          .toLowerCase()
          .startsWith(
            SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX,
          ),
      );
      if (!storyLabel) {
        continue;
      }

      const labelSuffix = storyLabel.slice(
        SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX.length,
      );
      const normalizedLabel =
        SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate(
          labelSuffix,
        );

      const matchingStory = story.stories.find((s) => {
        if (
          !s.name.startsWith(
            SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX,
          )
        ) {
          return false;
        }
        const storySuffix = s.name.slice(
          SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX.length,
        );
        return (
          normalizedLabel ===
          SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate(
            storySuffix,
          )
        );
      });

      if (!matchingStory) {
        await this.notifyUnmatchedStoryLabel(issue, storyLabel, labelSuffix);
        continue;
      }

      await this.issueRepository.updateStory(
        { ...input.project, story },
        issue,
        matchingStory.id,
      );
      await this.issueRepository.removeLabel(issue, storyLabel);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };

  static buildUnmatchedStoryLabelTitle = (
    storyLabel: string,
    labelSuffix: string,
  ): string =>
    `TDPM: story label "${storyLabel}" has no matching "${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}" Story option`;

  private notifyUnmatchedStoryLabel = async (
    issue: Issue,
    storyLabel: string,
    labelSuffix: string,
  ): Promise<void> => {
    const title =
      SetWorkflowManagementIssueToStoryUseCase.buildUnmatchedStoryLabelTitle(
        storyLabel,
        labelSuffix,
      );
    const existingOpenIssues = await this.issueRepository.searchIssue({
      owner: issue.org,
      repositoryName: issue.repo,
      type: 'issue',
      state: 'open',
      title,
    });
    const alreadyNotified = existingOpenIssues.some(
      (existing) => existing.title === title,
    );
    if (alreadyNotified) {
      return;
    }
    const body = this.buildUnmatchedStoryLabelBody(issue, storyLabel);
    await this.issueRepository.createNewIssue(
      issue.org,
      issue.repo,
      title,
      body,
      [issue.org],
      [],
    );
  };

  private buildUnmatchedStoryLabelBody = (
    issue: Issue,
    storyLabel: string,
  ): string => {
    const labelSuffix = storyLabel.slice(
      SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX.length,
    );
    return [
      'From: :robot: SetWorkflowManagementIssueToStoryUseCase',
      '',
      `The issue below carries the label \`${storyLabel}\`, but the project has no matching \`${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}\` Story option.`,
      '',
      issue.url,
      '',
      `Because no matching \`${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}\` Story option exists, the label cannot be auto-converted to a Story.`,
      'Add the missing Story option to the project, or correct the label on the issue above, to resolve this.',
    ].join('\n');
  };

  private isEligibleIssue = (issue: Issue, targetDates: Date[]): boolean => {
    const hasStoryOrWorkflowTrigger =
      issue.labels.some((label) =>
        label
          .toLowerCase()
          .startsWith(
            SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX,
          ),
      ) ||
      issue.labels.includes(
        SetWorkflowManagementIssueToStoryUseCase.DAILY_ROUTINE_LABEL,
      ) ||
      issue.isPr;

    return (
      hasStoryOrWorkflowTrigger &&
      (issue.nextActionDate === null ||
        issue.nextActionDate.getTime() <= targetDates[0].getTime()) &&
      issue.nextActionHour === null &&
      issue.state === 'OPEN' &&
      issue.story === null
    );
  };
}
