import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class IssueNoStatusUpdateUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'updateStatus'>,
  ) {}

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    const awaitingWorkspaceStatus = input.project.status.statuses.find(
      (s) => s.name === 'Awaiting Workspace',
    );
    if (!awaitingWorkspaceStatus) {
      return;
    }
    for (const issue of input.issues) {
      if (issue.isClosed || issue.status !== null) {
        continue;
      }
      await this.issueRepository.updateStatus(
        input.project,
        issue,
        awaitingWorkspaceStatus.id,
      );
    }
  };
}
