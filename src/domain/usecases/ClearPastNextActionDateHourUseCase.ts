import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class ClearPastNextActionDateHourUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'clearProjectField'>,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
  }): Promise<void> => {
    if (input.targetDates.length === 0) {
      return;
    }
    const now = input.targetDates[input.targetDates.length - 1];

    const nextActionHour = input.project.nextActionHour;
    if (nextActionHour) {
      const nextActionDate = input.project.nextActionDate;
      const targetDatesAtHour45 = input.targetDates
        .filter((targetDate) => targetDate.getMinutes() === 45)
        .reverse();
      if (targetDatesAtHour45.length > 0) {
        const targetDate = new Date(
          targetDatesAtHour45[targetDatesAtHour45.length - 1].getTime() +
            5 * 60 * 1000,
        );
        const targetHour = targetDate.getHours() + 1;
        for (const issue of input.issues) {
          if (
            issue.nextActionHour === null ||
            issue.nextActionHour > targetHour ||
            (issue.nextActionDate !== null &&
              issue.nextActionDate.getTime() > targetDate.getTime()) ||
            issue.state !== 'OPEN'
          ) {
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
      }
    }

    const nextActionDate = input.project.nextActionDate;
    if (!nextActionDate) {
      return;
    }
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    for (const issue of input.issues) {
      if (
        issue.nextActionHour !== null ||
        (issue.nextActionDate?.getTime() ?? Infinity) >=
          startOfTomorrow.getTime() ||
        issue.state !== 'OPEN'
      ) {
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
