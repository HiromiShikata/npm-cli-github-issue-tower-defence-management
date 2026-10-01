import type { Issue } from '../entities/Issue';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { issueReactivationTriggerIsPending } from './issueReactivationTriggerIsPending';

export const URGENT_STORY_LAUNCH_HOLD_TIMED_OUT_ISSUE_IGNORED_SECONDS = 1800;

export type UrgentStoryLaunchHoldBoardIssue = Pick<
  Issue,
  | 'url'
  | 'story'
  | 'status'
  | 'isClosed'
  | 'dependedIssueUrls'
  | 'nextActionDate'
  | 'nextActionHour'
  | 'assignees'
>;

export type UrgentStoryLaunchHoldBoardProject = {
  projectUrl: string | null;
  issues: UrgentStoryLaunchHoldBoardIssue[];
  readmeMaximumPreparingIssuesCount: number | null;
};

export type UrgentStoryLaunchHoldBoardState = {
  projects: UrgentStoryLaunchHoldBoardProject[];
  runningIssueUrls: string[];
  heldProjectUrls: string[];
  timedOutIssueUrls: string[];
};

export type UrgentStoryLaunchHoldDecideInput = {
  urgentStoryNames: string[];
  callerIssueUrl: string;
  configuredProjectUrl: string | null;
  manager: string | null;
  boardState: UrgentStoryLaunchHoldBoardState;
  freeSlotCount: number | null;
  now: Date;
};

type UrgentStoryLaunchHoldCaller = {
  callerProjectUrl: string | null;
  callerStory: string | null;
};

export type UrgentStoryLaunchHoldDecision = UrgentStoryLaunchHoldCaller &
  (
    | { kind: 'callerStoryIsUrgent' }
    | { kind: 'urgentTaskDependsOnCaller'; dependingUrgentIssueUrl: string }
    | { kind: 'noUrgentTaskWaiting' }
    | { kind: 'freeSlotCountUnknown' }
    | {
        kind: 'freeSlotsExceedWaitingUrgentTasks';
        freeSlotCount: number;
        waitingUrgentIssueUrls: string[];
      }
    | {
        kind: 'hold';
        freeSlotCount: number;
        waitingUrgentIssueUrls: string[];
      }
  );

const issueStoryIsUrgent = (
  issue: UrgentStoryLaunchHoldBoardIssue,
  urgentStoryNames: string[],
): boolean => issue.story !== null && urgentStoryNames.includes(issue.story);

const callerProjectFind = (
  input: UrgentStoryLaunchHoldDecideInput,
): UrgentStoryLaunchHoldBoardProject | null =>
  input.boardState.projects.find(
    (project) => project.projectUrl === input.configuredProjectUrl,
  ) ??
  input.boardState.projects.find((project) =>
    project.issues.some((issue) => issue.url === input.callerIssueUrl),
  ) ??
  null;

const urgentIssueDependingOnCallerFind = (
  input: UrgentStoryLaunchHoldDecideInput,
): UrgentStoryLaunchHoldBoardIssue | null =>
  input.boardState.projects
    .flatMap((project) => project.issues)
    .find(
      (issue) =>
        issue.dependedIssueUrls.includes(input.callerIssueUrl) &&
        issueStoryIsUrgent(issue, input.urgentStoryNames) &&
        !issue.isClosed &&
        issue.status === AWAITING_WORKSPACE_STATUS_NAME,
    ) ?? null;

const projectWaitingUrgentIssueUrlsList = (
  project: UrgentStoryLaunchHoldBoardProject,
  input: UrgentStoryLaunchHoldDecideInput,
): string[] => {
  const waitingUrgentIssues = project.issues.filter(
    (issue) =>
      issue.status === AWAITING_WORKSPACE_STATUS_NAME &&
      !issue.isClosed &&
      issueStoryIsUrgent(issue, input.urgentStoryNames) &&
      issue.dependedIssueUrls.length === 0 &&
      !issueReactivationTriggerIsPending(issue, input.now) &&
      (input.manager === null || issue.assignees.includes(input.manager)) &&
      !input.boardState.runningIssueUrls.includes(issue.url) &&
      !input.boardState.timedOutIssueUrls.includes(issue.url),
  );
  const preparingIssueCount = project.issues.filter(
    (issue) => issue.status === PREPARATION_STATUS_NAME && !issue.isClosed,
  ).length;
  const preparationRoomCount =
    project.readmeMaximumPreparingIssuesCount === null
      ? waitingUrgentIssues.length
      : Math.max(
          0,
          project.readmeMaximumPreparingIssuesCount - preparingIssueCount,
        );
  return waitingUrgentIssues
    .slice(0, preparationRoomCount)
    .map((issue) => issue.url);
};

export const urgentStoryLaunchHoldDecide = (
  input: UrgentStoryLaunchHoldDecideInput,
): UrgentStoryLaunchHoldDecision => {
  const callerProject = callerProjectFind(input);
  const caller: UrgentStoryLaunchHoldCaller = {
    callerProjectUrl: callerProject?.projectUrl ?? null,
    callerStory:
      callerProject?.issues.find((issue) => issue.url === input.callerIssueUrl)
        ?.story ?? null,
  };
  if (
    caller.callerStory !== null &&
    input.urgentStoryNames.includes(caller.callerStory)
  ) {
    return { kind: 'callerStoryIsUrgent', ...caller };
  }
  const urgentIssueDependingOnCaller = urgentIssueDependingOnCallerFind(input);
  if (urgentIssueDependingOnCaller !== null) {
    return {
      kind: 'urgentTaskDependsOnCaller',
      dependingUrgentIssueUrl: urgentIssueDependingOnCaller.url,
      ...caller,
    };
  }
  const waitingUrgentIssueUrls = input.boardState.projects
    .filter(
      (project) =>
        project.projectUrl !== caller.callerProjectUrl &&
        !(
          project.projectUrl !== null &&
          input.boardState.heldProjectUrls.includes(project.projectUrl)
        ),
    )
    .flatMap((project) => projectWaitingUrgentIssueUrlsList(project, input));
  if (waitingUrgentIssueUrls.length === 0) {
    return { kind: 'noUrgentTaskWaiting', ...caller };
  }
  const { freeSlotCount } = input;
  if (freeSlotCount === null || !Number.isFinite(freeSlotCount)) {
    return { kind: 'freeSlotCountUnknown', ...caller };
  }
  if (freeSlotCount > waitingUrgentIssueUrls.length) {
    return {
      kind: 'freeSlotsExceedWaitingUrgentTasks',
      freeSlotCount,
      waitingUrgentIssueUrls,
      ...caller,
    };
  }
  return { kind: 'hold', freeSlotCount, waitingUrgentIssueUrls, ...caller };
};
