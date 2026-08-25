import { Issue } from '../entities/Issue';

export const issueReactivationTriggerStartOfTomorrow = (
  evaluatedAt: Date,
): Date =>
  new Date(
    Date.UTC(
      evaluatedAt.getUTCFullYear(),
      evaluatedAt.getUTCMonth(),
      evaluatedAt.getUTCDate() + 1,
    ),
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
    evaluatedAt.getUTCHours() < issue.nextActionHour;
  return hasFutureNextActionDate || hasUnreachedNextActionHour;
};
