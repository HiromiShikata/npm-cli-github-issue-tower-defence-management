import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { NO_STORY_STORY_NAME } from '../entities/RequiredProjectField';

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
    for (const issue of input.issues) {
      if (!isTargetIssue(issue)) {
        continue;
      }
      const storyStillUnset = await this.isStoryStillUnset(
        issue,
        input.project,
      );
      if (!storyStillUnset) {
        continue;
      }
      await this.issueRepository.updateStory(
        { ...input.project, story },
        issue,
        noStoryOption.id,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };

  private isStoryStillUnset = async (
    issue: Issue,
    project: Project,
  ): Promise<boolean> => {
    let liveIssue: Issue | null;
    try {
      liveIssue = await this.issueRepository.get(issue.url, project);
    } catch (error) {
      console.error(
        `Failed to re-read the live Story value before writing NO STORY. issueUrl: ${issue.url}`,
        error,
      );
      return false;
    }
    return liveIssue !== null && liveIssue.story === null;
  };
}
