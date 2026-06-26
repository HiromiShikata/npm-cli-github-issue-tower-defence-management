import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class SetDependedIssueUrlForOpenTaskPRsUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'setDependedIssueUrl'>,
  ) {}

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    if (!input.project.dependedIssueUrlSeparatedByComma) {
      console.warn(
        `dependedIssueUrlSeparatedByComma field not configured in project, skipping SetDependedIssueUrlForOpenTaskPRsUseCase`,
      );
      return;
    }
    const openPrUrlsByClosedIssueUrl = this.buildOpenPrUrlsByClosedIssueUrl(
      input.issues,
    );
    for (const issue of input.issues) {
      if (issue.isPr || issue.isClosed) {
        continue;
      }
      const relatedOpenPrUrls = openPrUrlsByClosedIssueUrl.get(issue.url);
      if (!relatedOpenPrUrls) {
        continue;
      }
      for (const prUrl of relatedOpenPrUrls) {
        try {
          await this.issueRepository.setDependedIssueUrl(
            prUrl,
            input.project,
            issue.url,
          );
        } catch (error) {
          console.warn(
            `Failed to set depended issue URL for PR ${prUrl}, skipping and continuing with remaining PRs: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  };

  private buildOpenPrUrlsByClosedIssueUrl = (
    issues: Issue[],
  ): Map<string, string[]> => {
    const openPrUrlsByClosedIssueUrl = new Map<string, Set<string>>();
    for (const issue of issues) {
      if (!issue.isPr || issue.isClosed) {
        continue;
      }
      for (const closedIssueUrl of issue.closingIssueReferenceUrls) {
        const existing = openPrUrlsByClosedIssueUrl.get(closedIssueUrl);
        if (existing) {
          existing.add(issue.url);
        } else {
          openPrUrlsByClosedIssueUrl.set(closedIssueUrl, new Set([issue.url]));
        }
      }
    }
    const result = new Map<string, string[]>();
    for (const [closedIssueUrl, prUrls] of openPrUrlsByClosedIssueUrl) {
      result.set(closedIssueUrl, Array.from(prUrls));
    }
    return result;
  };
}
