import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class SetWorkflowManagementIssueToStoryUseCase {
  constructor(readonly issueRepository: Pick<IssueRepository, 'updateStory'>) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
  }): Promise<void> => {
    const story = input.project.story;
    if (
      !story ||
      input.cacheUsed ||
      !input.targetDates.find((targetDate) => targetDate.getMinutes() === 0)
    ) {
      return;
    }
    const isTargetIssue = (issue: Issue): boolean => {
      return (
        (issue.labels.includes('story:workflow-management') ||
          issue.labels.includes('daily-routine') ||
          issue.isPr) &&
        (issue.nextActionDate === null ||
          issue.nextActionDate.getTime() <= input.targetDates[0].getTime()) &&
        issue.nextActionHour === null &&
        issue.state === 'OPEN'
      );
    };
    for (const issue of input.issues) {
      if (!isTargetIssue(issue)) {
        continue;
      }
      await this.issueRepository.updateStory(
        { ...input.project, story },
        issue,
        story.workflowManagementStory.id,
      );
    }
  };
}
