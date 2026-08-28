import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { issueReactivationTriggerIsPending } from './issueReactivationTriggerIsPending';

export class QualityCheckAdvanceUseCase {
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'updateStatus'>,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    awaitingQualityCheckStatusName?: string;
    evaluatedAt?: Date;
  }): Promise<number> => {
    const qualityCheckStatusName =
      params.awaitingQualityCheckStatusName ??
      AWAITING_QUALITY_CHECK_STATUS_NAME;
    const evaluatedAt = params.evaluatedAt ?? new Date();
    const doneStatusOption = params.project.status.statuses.find(
      (s) => s.name === DONE_STATUS_NAME,
    );
    if (!doneStatusOption) {
      console.error(
        `Done status option '${DONE_STATUS_NAME}' not found in project.`,
      );
      return 0;
    }

    const issueUrlsWithMergedPr = new Set<string>();
    for (const item of params.issues) {
      if (item.isPr && item.state === 'MERGED') {
        for (const referencedIssueUrl of item.closingIssueReferenceUrls) {
          issueUrlsWithMergedPr.add(referencedIssueUrl);
        }
      }
    }

    const itemsToAdvance = params.issues.filter(
      (issue) =>
        issue.status === qualityCheckStatusName &&
        !issue.isClosed &&
        issue.stateReason !== 'REOPENED' &&
        issue.dependedIssueUrls.length === 0 &&
        !issueReactivationTriggerIsPending(issue, evaluatedAt) &&
        issueUrlsWithMergedPr.has(issue.url),
    );

    let advancedCount = 0;
    const errors: unknown[] = [];
    for (const issue of itemsToAdvance) {
      try {
        await this.issueRepository.updateStatus(
          params.project,
          issue,
          doneStatusOption.id,
        );
        advancedCount++;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to advance ${errors.length} issue(s) from ${qualityCheckStatusName} to ${DONE_STATUS_NAME}`,
      );
    }
    return advancedCount;
  };
}
