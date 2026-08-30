import { Issue } from '../../entities/Issue';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  PREPARATION_STATUS_NAME,
  TODO_STATUS_NAME,
} from '../../entities/WorkflowStatus';

export type DashboardRow = {
  todo: number;
  qc: number;
  fail: number;
  pr: number;
  ws: number;
  dep: number;
  blocker: number;
  humanPendingRed: number;
  humanPendingYellow: number;
  humanPendingBlue: number;
};

export type GenerateDashboardRowInput = {
  issues: Issue[];
  assigneeLogin: string;
  storyColorMap: Map<string, string>;
};

const WORKFLOW_BLOCKER_STORY_MARKER = 'workflow blocker';

export class GenerateDashboardRowUseCase {
  run = (input: GenerateDashboardRowInput): DashboardRow => {
    const { issues, assigneeLogin, storyColorMap } = input;

    const mine = (issue: Issue): boolean =>
      issue.isClosed === false && issue.assignees.includes(assigneeLogin);

    const actionable = (issue: Issue): boolean =>
      mine(issue) &&
      issue.dependedIssueUrls.length === 0 &&
      issue.nextActionDate === null &&
      issue.nextActionHour === null;

    const countActionableWithStatus = (statusName: string): number =>
      issues.filter((issue) => issue.status === statusName && actionable(issue))
        .length;

    const countMineWithStatus = (statusName: string): number =>
      issues.filter((issue) => mine(issue) && issue.status === statusName)
        .length;

    const countHumanPendingByStoryColor = (color: string): number =>
      issues.filter(
        (issue) =>
          issue.isClosed === false &&
          (issue.status === AWAITING_QUALITY_CHECK_STATUS_NAME ||
            issue.status === TODO_STATUS_NAME) &&
          issue.story !== null &&
          storyColorMap.get(issue.story) === color,
      ).length;

    return {
      todo: countActionableWithStatus(TODO_STATUS_NAME),
      qc: countActionableWithStatus(AWAITING_QUALITY_CHECK_STATUS_NAME),
      fail: countMineWithStatus(FAILED_PREPARATION_STATUS_NAME),
      pr: countMineWithStatus(PREPARATION_STATUS_NAME),
      ws: countActionableWithStatus(AWAITING_WORKSPACE_STATUS_NAME),
      dep: issues.filter(
        (issue) =>
          mine(issue) &&
          issue.status === AWAITING_WORKSPACE_STATUS_NAME &&
          issue.dependedIssueUrls.length > 0,
      ).length,
      blocker: issues.filter(
        (issue) =>
          mine(issue) &&
          (issue.story ?? '')
            .toLowerCase()
            .includes(WORKFLOW_BLOCKER_STORY_MARKER),
      ).length,
      humanPendingRed: countHumanPendingByStoryColor('RED'),
      humanPendingYellow: countHumanPendingByStoryColor('YELLOW'),
      humanPendingBlue: countHumanPendingByStoryColor('BLUE'),
    };
  };
}
