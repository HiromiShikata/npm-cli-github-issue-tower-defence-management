import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class ClearNextActionHourUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'clearProjectField'>,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
  }): Promise<void> => {
    const nextActionHour = input.project.nextActionHour;
    if (!nextActionHour) {
      return;
    }
    const nextActionDate = input.project.nextActionDate;
    const targetDates = input.targetDates
      .filter((targetDate) => targetDate.getMinutes() === 45)
      .reverse();
    if (targetDates.length === 0) {
      return;
    }
    const targetDate = new Date(
      targetDates[targetDates.length - 1].getTime() + 5 * 60 * 1000,
    );
    const targetHour = targetDate.getHours() + 1;
    const isTargetIssue = (issue: Issue): boolean => {
      return (
        issue.nextActionHour !== null &&
        issue.nextActionHour <= targetHour &&
        (issue.nextActionDate === null ||
          issue.nextActionDate.getTime() <= targetDate.getTime()) &&
        issue.state === 'OPEN'
      );
    };
    for (const issue of input.issues) {
      if (!isTargetIssue(issue)) {
        continue;
      }
      await this.issueRepository.clearProjectField(
        input.project,
        nextActionHour.fieldId,
        issue,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (!nextActionDate) {
        continue;
      }
      await this.issueRepository.clearProjectField(
        input.project,
        nextActionDate.fieldId,
        issue,
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };
}
