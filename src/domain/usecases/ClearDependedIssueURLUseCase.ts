import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';

export class ClearDependedIssueURLUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'clearProjectField' | 'createComment' | 'updateProjectTextField'
    >,
  ) {}

  run = async (input: {
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    allowedExternalRepoNameWithOwner?: string | null;
  }): Promise<void> => {
    const dependedIssueUrlSeparatedByComma =
      input.project.dependedIssueUrlSeparatedByComma;
    if (!dependedIssueUrlSeparatedByComma) {
      return;
    }
    const absentDependedIssueIsResolvable = !input.cacheUsed;
    for (const issue of input.issues) {
      if (issue.dependedIssueUrls.length <= 0 || issue.isClosed) {
        continue;
      }
      const circularDependedIssueUrls = absentDependedIssueIsResolvable
        ? this.findCircularDependedIssueUrls(issue, input.issues)
        : [];
      if (circularDependedIssueUrls.length > 0) {
        await this.issueRepository.clearProjectField(
          input.project,
          dependedIssueUrlSeparatedByComma.fieldId,
          issue,
        );
        await this.issueRepository.createComment(
          issue,
          `Circular dependency removed:
${circularDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
        continue;
      }
      const allowedExternalDependedIssueUrls = absentDependedIssueIsResolvable
        ? issue.dependedIssueUrls.filter(
            (url) =>
              this.isFromAllowedExternalRepo(
                url,
                input.allowedExternalRepoNameWithOwner,
              ) && !input.issues.some((depIssue) => depIssue.url === url),
          )
        : [];
      const notFoundDependedIssueUrls = absentDependedIssueIsResolvable
        ? issue.dependedIssueUrls.filter(
            (dependedIssueUrl) =>
              !input.issues.some(
                (depIssue) => depIssue.url === dependedIssueUrl,
              ) &&
              !this.isFromAllowedExternalRepo(
                dependedIssueUrl,
                input.allowedExternalRepoNameWithOwner,
              ),
          )
        : [];
      const iceboxDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some(
            (depIssue) =>
              depIssue.url === dependedIssueUrl &&
              !depIssue.isClosed &&
              depIssue.status === ICEBOX_STATUS_NAME,
          ),
      );
      const openDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some(
            (depIssue) =>
              depIssue.url === dependedIssueUrl &&
              !depIssue.isClosed &&
              depIssue.status !== ICEBOX_STATUS_NAME,
          ),
      );
      const closedDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some(
            (depIssue) =>
              depIssue.url === dependedIssueUrl && depIssue.isClosed,
          ),
      );
      if (
        notFoundDependedIssueUrls.length === 0 &&
        closedDependedIssueUrls.length === 0 &&
        iceboxDependedIssueUrls.length === 0
      ) {
        continue;
      }
      const remainingDependedIssueUrls = absentDependedIssueIsResolvable
        ? [...openDependedIssueUrls, ...allowedExternalDependedIssueUrls]
        : issue.dependedIssueUrls.filter(
            (dependedIssueUrl) =>
              !closedDependedIssueUrls.includes(dependedIssueUrl) &&
              !iceboxDependedIssueUrls.includes(dependedIssueUrl),
          );
      if (remainingDependedIssueUrls.length === 0) {
        await this.issueRepository.clearProjectField(
          input.project,
          dependedIssueUrlSeparatedByComma.fieldId,
          issue,
        );
      } else {
        await this.issueRepository.updateProjectTextField(
          input.project,
          dependedIssueUrlSeparatedByComma.fieldId,
          issue,
          remainingDependedIssueUrls.join(','),
        );
      }
      if (closedDependedIssueUrls.length > 0) {
        const allCleared =
          remainingDependedIssueUrls.length === 0 &&
          notFoundDependedIssueUrls.length === 0 &&
          iceboxDependedIssueUrls.length === 0;
        await this.issueRepository.createComment(
          issue,
          `${allCleared ? 'All depended issues are already closed, dependency field cleared' : 'Some depended issues are already closed, removed from dependency field'}:
${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
      }
      if (notFoundDependedIssueUrls.length > 0) {
        await this.issueRepository.createComment(
          issue,
          `Dependency removed:
${notFoundDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
      }
      if (iceboxDependedIssueUrls.length > 0) {
        const iceboxAllCleared =
          remainingDependedIssueUrls.length === 0 &&
          closedDependedIssueUrls.length === 0 &&
          notFoundDependedIssueUrls.length === 0;
        await this.issueRepository.createComment(
          issue,
          `${iceboxAllCleared ? 'All depended issues are in Icebox, dependency field cleared' : 'Some depended issues are in Icebox, removed from dependency field'}:\n${iceboxDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
      }
    }
  };

  private isFromAllowedExternalRepo = (
    url: string,
    allowedExternalRepoNameWithOwner: string | null | undefined,
  ): boolean => {
    if (!allowedExternalRepoNameWithOwner) return false;
    return url.startsWith(
      `https://github.com/${allowedExternalRepoNameWithOwner}/`,
    );
  };

  private findCircularDependedIssueUrls = (
    issue: Issue,
    issues: Issue[],
  ): string[] =>
    issue.dependedIssueUrls.filter((dependedIssueUrl) => {
      const reachableIssueUrls = new Set<string>();
      const stack = [dependedIssueUrl];
      while (stack.length > 0) {
        const url = stack.pop();
        if (!url) {
          throw new Error('url is undefined');
        }
        if (reachableIssueUrls.has(url)) {
          continue;
        }
        reachableIssueUrls.add(url);
        const dependedIssue = issues.find((candidate) => candidate.url === url);
        if (!dependedIssue) {
          continue;
        }
        stack.push(...dependedIssue.dependedIssueUrls);
      }
      return reachableIssueUrls.has(issue.url);
    });
}
