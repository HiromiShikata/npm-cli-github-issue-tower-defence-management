import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Member } from '../entities/Member';

export class AssignNoAssigneeIssueToManagerUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'updateAssigneeList'>,
  ) {}

  run = async (input: {
    issues: Issue[];
    manager: Member['name'];
    cacheUsed: boolean;
  }): Promise<void> => {
    if (input.cacheUsed) {
      return;
    }
    for (const issue of input.issues) {
      if (issue.assignees.length > 0 || issue.state !== 'OPEN') {
        continue;
      }
      try {
        await this.issueRepository.updateAssigneeList(issue, [input.manager]);
      } catch (e) {
        console.warn(
          `Failed to assign manager to issue ${issue.url}: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };
}
