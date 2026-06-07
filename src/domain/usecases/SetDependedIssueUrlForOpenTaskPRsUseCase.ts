import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class SetDependedIssueUrlForOpenTaskPRsUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'findRelatedOpenPRs' | 'setDependedIssueUrl'
    >,
  ) {}

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    if (!input.project.dependedIssueUrlSeparatedByComma) {
      console.warn(
        `dependedIssueUrlSeparatedByComma field not configured in project, skipping SetDependedIssueUrlForOpenTaskPRsUseCase`,
      );
      return;
    }
    for (const issue of input.issues) {
      if (issue.isPr || issue.isClosed) {
        continue;
      }
      const relatedOpenPRs = await this.issueRepository.findRelatedOpenPRs(
        issue.url,
      );
      for (const pr of relatedOpenPRs) {
        try {
          await this.issueRepository.setDependedIssueUrl(
            pr.url,
            input.project,
            issue.url,
          );
        } catch (error) {
          console.warn(
            `Failed to set depended issue URL for PR ${pr.url}, skipping and continuing with remaining PRs: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  };
}
