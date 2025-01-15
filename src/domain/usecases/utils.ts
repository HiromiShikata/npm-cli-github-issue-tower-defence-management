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
    issue.status === disabledStatus ||
    issue.dependedIssueUrls.length > 0 ||
    issue.status?.toLowerCase().includes('review')
  ) {
    return false;
  }
  return true;
};
export const encodeForURI = (url?: string | null): string => {
  if (!url) {
    return '';
  }
  return encodeURI(url).replace('#', '%23').replace('&', '%26');
};
