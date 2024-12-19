import { Issue } from '../entities/Issue';
import { Member } from '../entities/Member';

export const isVisibleIssue = (
  issue: Issue,
  member: Member['name'],
  targetDate: Date,
  disabledStatus: string,
): boolean => {
  if (
    (issue.nextActionDate !== null &&
      issue.nextActionDate.getTime() > targetDate.getTime()) ||
    (issue.nextActionHour !== null &&
      issue.nextActionHour > targetDate.getHours()) ||
    issue.state !== 'OPEN' ||
    !issue.assignees.includes(member) ||
    issue.status === disabledStatus
  ) {
    return false;
  }
  return true;
};
