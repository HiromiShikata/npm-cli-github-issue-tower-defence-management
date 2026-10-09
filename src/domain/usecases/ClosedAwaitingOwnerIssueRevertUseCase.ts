import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { isAgentComment, TrustedAuthorCheck } from './isAgentComment';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

export class ClosedAwaitingOwnerIssueRevertUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'reopenIssueByUrl'
      | 'updateStatus'
      | 'get'
      | 'removeIssueFromProjectCache'
      | 'getLatestReopenedEventAt'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue'
    >,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    allowedIssueAuthors?: string[] | null;
  }): Promise<number> => {
    const { project, allowedIssueAuthors } = params;
    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (statusOption) => statusOption.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      console.error(
        `ClosedAwaitingOwnerIssueRevertUseCase: status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project ${project.url}.`,
      );
      return 0;
    }

    const candidateIssues = params.issues.filter(
      (issue) =>
        !issue.isPr &&
        issue.status === AWAITING_OWNER_STATUS_NAME &&
        (issue.isClosed === true || issue.stateReason === 'REOPENED'),
    );

    let revertedCount = 0;
    const errors: unknown[] = [];
    for (const issue of candidateIssues) {
      try {
        let shouldReopen = true;
        if (issue.stateReason === 'REOPENED' && issue.isClosed === false) {
          shouldReopen = false;
          const latestReopenedAt =
            await this.issueRepository.getLatestReopenedEventAt(issue);
          if (latestReopenedAt === null) {
            console.warn(
              `ClosedAwaitingOwnerIssueRevertUseCase: no reopened-event timeline entry found for issue with stateReason REOPENED despite GitHub reporting one, skipping. issueUrl: ${issue.url}`,
            );
            continue;
          }
          const comments =
            await this.issueCommentRepository.getCommentsFromIssue(issue);
          const isTrustedAuthor: TrustedAuthorCheck = (author) =>
            isAuthorAuthorizedForAutoStatusCheck(author, allowedIssueAuthors);
          const hasFreshAgentComment = comments.some(
            (comment) =>
              comment.createdAt.getTime() > latestReopenedAt.getTime() &&
              isAgentComment(comment, isTrustedAuthor),
          );
          if (hasFreshAgentComment) {
            continue;
          }
        }

        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project,
          snapshotIssue: issue,
          checkedFieldNames: ['status', 'isClosed', 'stateReason'],
          skippedWriteDescription: `the revert of closed/reopened ${AWAITING_OWNER_STATUS_NAME} issue ${issue.url} to ${AWAITING_WORKSPACE_STATUS_NAME}`,
        });
        if (staleness.type !== 'current') {
          continue;
        }

        if (shouldReopen) {
          await this.issueRepository.reopenIssueByUrl(issue.url);
        }

        try {
          await this.issueRepository.updateStatus(
            project,
            staleness.liveIssue,
            awaitingWorkspaceStatusOption.id,
          );
        } catch (error) {
          if (error instanceof StaleProjectItemError) {
            console.warn(
              `ClosedAwaitingOwnerIssueRevertUseCase: project item no longer exists in GitHub, skipping. issueUrl: ${issue.url} itemId: ${error.itemId}`,
            );
            continue;
          }
          throw error;
        }

        revertedCount++;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to revert ${errors.length} issue(s) to ${AWAITING_WORKSPACE_STATUS_NAME}`,
      );
    }
    return revertedCount;
  };
}
