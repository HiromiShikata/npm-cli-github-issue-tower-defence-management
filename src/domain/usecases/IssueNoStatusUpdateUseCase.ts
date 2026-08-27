import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { AWAITING_WORKSPACE_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

const isArchivedProjectItemError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('archived');
};

export class IssueNoStatusUpdateUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'updateStatus'>,
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
