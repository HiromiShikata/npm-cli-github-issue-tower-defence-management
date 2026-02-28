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
        const originalMessage = e instanceof Error ? e.message : String(e);
        const originalStack = e instanceof Error ? e.stack : undefined;
        const error = new Error(
          `Failed to assign manager to issue ${issue.url}: ${originalMessage}`,
        );
        if (originalStack) {
          error.stack = `${error.stack}\nCaused by: ${originalStack}`;
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };
}
