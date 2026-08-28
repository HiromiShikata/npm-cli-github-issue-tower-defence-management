import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';

export class ReopenedDoneIssueRevertUseCase {
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'updateStatus'>,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
  }): Promise<number> => {
    const awaitingWorkspaceStatusOption = params.project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      console.error(
        `Awaiting Workspace status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project.`,
      );
      return 0;
    }

    const itemsToRevert = params.issues.filter(
      (issue) =>
        issue.status === DONE_STATUS_NAME &&
        issue.stateReason === 'REOPENED' &&
        !issue.isPr,
    );

    let revertedCount = 0;
    const errors: unknown[] = [];
    for (const issue of itemsToRevert) {
      try {
        await this.issueRepository.updateStatus(
          params.project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        revertedCount++;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to revert ${errors.length} issue(s) from ${DONE_STATUS_NAME} to ${AWAITING_WORKSPACE_STATUS_NAME}`,
      );
    }
    return revertedCount;
  };
}
