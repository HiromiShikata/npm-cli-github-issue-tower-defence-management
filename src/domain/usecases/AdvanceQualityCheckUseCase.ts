import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';

export class AdvanceQualityCheckUseCase {
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'updateStatus'>,
  ) {}

  run = async (params: {
    project: Project;
    issues: Issue[];
    awaitingQualityCheckStatusName?: string;
  }): Promise<number> => {
    const qualityCheckStatusName =
      params.awaitingQualityCheckStatusName ??
      AWAITING_QUALITY_CHECK_STATUS_NAME;
    const doneStatusOption = params.project.status.statuses.find(
      (s) => s.name === DONE_STATUS_NAME,
    );
    if (!doneStatusOption) {
      console.error(
        `Done status option '${DONE_STATUS_NAME}' not found in project.`,
      );
      return 0;
    }
    const itemsToAdvance = params.issues.filter(
      (issue) => issue.status === qualityCheckStatusName && !issue.isClosed,
    );
    let advancedCount = 0;
    for (const issue of itemsToAdvance) {
      await this.issueRepository.updateStatus(
        params.project,
        issue,
        doneStatusOption.id,
      );
      advancedCount++;
    }
    return advancedCount;
  };
}
