import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { NO_STORY_STORY_NAME } from '../entities/RequiredProjectField';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';

export class SetNoStoryIssueToStoryUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'updateStory' | 'get'>,
  ) {}

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
    const earliestTargetDate: Date | null = input.targetDates[0] ?? null;
    const isTargetIssue = (issue: Issue): boolean => {
      return (
        issue.story === null &&
        !issue.labels.some((label) =>
          label.toLowerCase().startsWith('story:'),
        ) &&
        (issue.nextActionDate === null ||
          (earliestTargetDate !== null &&
            issue.nextActionDate.getTime() <= earliestTargetDate.getTime())) &&
        issue.nextActionHour === null &&
        issue.state === 'OPEN'
      );
    };
    const noStoryOption = story.stories.find(
      (s) => s.name === NO_STORY_STORY_NAME,
    );
    if (!noStoryOption) {
      return;
    }
    const errors: unknown[] = [];
    for (const issue of input.issues) {
      if (!isTargetIssue(issue)) {
        continue;
      }
      try {
        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project: input.project,
          snapshotIssue: issue,
          checkedFieldNames: ['story'],
          skippedWriteDescription: `the ${NO_STORY_STORY_NAME} Story write`,
        });
        if (staleness.type !== 'current') {
          continue;
        }
      } catch (error) {
        errors.push(error);
        continue;
      }
      await this.issueRepository.updateStory(
        { ...input.project, story },
        issue,
        noStoryOption.id,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to re-read the live Story value for ${errors.length} issue(s) before writing NO STORY`,
      );
    }
  };
}
