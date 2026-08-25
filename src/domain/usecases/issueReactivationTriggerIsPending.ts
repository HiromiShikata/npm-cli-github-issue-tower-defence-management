import { Issue } from '../entities/Issue';

export const LAST_HOUR_OF_DAY = 23;

export const issueReactivationTriggerStartOfTomorrow = (
  evaluatedAt: Date,
): Date =>
  new Date(
    evaluatedAt.getFullYear(),
    evaluatedAt.getMonth(),
    evaluatedAt.getDate() + 1,
  );

export const issueReactivationTriggerIsPending = (
  issue: Pick<Issue, 'nextActionDate' | 'nextActionHour'>,
  evaluatedAt: Date,
): boolean => {
  const startOfTomorrow = issueReactivationTriggerStartOfTomorrow(evaluatedAt);
  const hasFutureNextActionDate =
    issue.nextActionDate !== null && issue.nextActionDate >= startOfTomorrow;
  const hasUnreachedNextActionHour =
    issue.nextActionHour !== null &&
    evaluatedAt.getHours() < issue.nextActionHour;
  return hasFutureNextActionDate || hasUnreachedNextActionHour;
};
