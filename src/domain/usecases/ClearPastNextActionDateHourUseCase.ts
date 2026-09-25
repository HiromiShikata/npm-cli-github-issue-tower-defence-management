import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { issueReactivationTriggerStartOfTomorrow } from './issueReactivationTriggerIsPending';

const isSameNextActionDate = (a: Date | null, b: Date | null): boolean => {
  if (a === null || b === null) {
    return a === b;
  }
  return a.getTime() === b.getTime();
};

export class ClearPastNextActionDateHourUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'clearProjectField' | 'get'
    >,
  ) {}

  private isLiveNextActionDateHourUnchanged = async (
    snapshotIssue: Issue,
    project: Project,
  ): Promise<boolean> => {
    let liveIssue: Issue | null;
    try {
      liveIssue = await this.issueRepository.get(snapshotIssue.url, project);
    } catch (error) {
      console.error(
        `[ClearPastNextActionDateHourUseCase] Failed to re-read the live Next Action Date/Hour before clearing. issueUrl: ${snapshotIssue.url}`,
        error,
      );
      return false;
    }
    return (
      liveIssue !== null &&
      liveIssue.nextActionHour === snapshotIssue.nextActionHour &&
      isSameNextActionDate(
        liveIssue.nextActionDate,
        snapshotIssue.nextActionDate,
      )
    );
  };

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

    const nextActionHourField = input.project.nextActionHour;
    if (nextActionHourField) {
      const nextActionDateField = input.project.nextActionDate;
      for (const issue of input.issues) {
        if (issue.nextActionHour === null || issue.state !== 'OPEN') {
          continue;
        }
        const scheduledDate = issue.nextActionDate ?? now;
        const scheduledTime = new Date(
          Date.UTC(
            scheduledDate.getUTCFullYear(),
            scheduledDate.getUTCMonth(),
            scheduledDate.getUTCDate(),
            issue.nextActionHour,
          ),
        );
        if (scheduledTime.getTime() > now.getTime()) {
          continue;
        }
        if (
          !(await this.isLiveNextActionDateHourUnchanged(issue, input.project))
        ) {
          continue;
        }
        await this.issueRepository.clearProjectField(
          input.project,
          nextActionHourField.fieldId,
          issue,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (!nextActionDateField || issue.nextActionDate === null) {
          continue;
        }
        await this.issueRepository.clearProjectField(
          input.project,
          nextActionDateField.fieldId,
          issue,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    const nextActionDate = input.project.nextActionDate;
    if (!nextActionDate) {
      return;
    }
    const startOfTomorrow = issueReactivationTriggerStartOfTomorrow(now);
    for (const issue of input.issues) {
      if (
        issue.nextActionHour !== null ||
        (issue.nextActionDate?.getTime() ?? Infinity) >=
          startOfTomorrow.getTime() ||
        issue.state !== 'OPEN'
      ) {
        continue;
      }
      if (
        !(await this.isLiveNextActionDateHourUnchanged(issue, input.project))
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
