import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { AWAITING_WORKSPACE_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';

const isArchivedProjectItemError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('archived');
};

export class IssueNoStatusUpdateUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'updateStatus' | 'get'>,
  ) {}

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    const awaitingWorkspaceStatus = input.project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatus) {
      return;
    }
    for (const issue of input.issues) {
      if (issue.isClosed || issue.status !== null) {
        continue;
      }
      const staleness = await issueSnapshotStalenessCheck({
        issueRepository: this.issueRepository,
        project: input.project,
        snapshotIssue: issue,
        checkedFieldNames: ['status', 'isClosed'],
        skippedWriteDescription: `the ${AWAITING_WORKSPACE_STATUS_NAME} Status write`,
      });
      if (staleness.type !== 'current') {
        continue;
      }
      try {
        await this.issueRepository.updateStatus(
          input.project,
          issue,
          awaitingWorkspaceStatus.id,
        );
      } catch (error) {
        if (isArchivedProjectItemError(error)) {
          console.warn(
            `IssueNoStatusUpdateUseCase: project item is archived and cannot be updated, skipping. issueUrl: ${issue.url}`,
          );
          continue;
        }
        throw error;
      }
    }
  };
}
