import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

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
  }): Promise<void> => {
    const dependedIssueUrlSeparatedByComma =
      input.project.dependedIssueUrlSeparatedByComma;
    if (!dependedIssueUrlSeparatedByComma || input.cacheUsed) {
      return;
    }
    for (const issue of input.issues) {
      if (issue.dependedIssueUrls.length <= 0 || issue.isClosed) {
        continue;
      }
      const circularDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) => {
          // get all depended issues circularly
          const circularDependedIssues = new Set<string>();
          const stack = [dependedIssueUrl];
          while (stack.length > 0) {
            const url = stack.pop();
            if (!url) {
              throw new Error('url is undefined');
            }
            if (circularDependedIssues.has(url)) {
              continue;
            }
            circularDependedIssues.add(url);
            const dependedIssue = input.issues.find(
              (issue) => issue.url === url,
            );
            if (!dependedIssue) {
              continue;
            }
            stack.push(...dependedIssue.dependedIssueUrls);
          }
          return circularDependedIssues.has(issue.url);
        },
      );
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
      const remainingDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some((issue) => {
            const r = issue.url === dependedIssueUrl && !issue.isClosed;
            return r;
          }),
      );
      const closedDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          remainingDependedIssueUrls.indexOf(dependedIssueUrl) === -1,
      );
      if (
        remainingDependedIssueUrls.length === issue.dependedIssueUrls.length
      ) {
        continue;
      }
      if (remainingDependedIssueUrls.length === 0) {
        await this.issueRepository.clearProjectField(
          input.project,
          dependedIssueUrlSeparatedByComma.fieldId,
          issue,
        );
        await this.issueRepository.createComment(
          issue,
          `Closed all depended issues:
${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
      } else {
        await this.issueRepository.updateProjectTextField(
          input.project,
          dependedIssueUrlSeparatedByComma.fieldId,
          issue,
          remainingDependedIssueUrls.join(','),
        );
        await this.issueRepository.createComment(
          issue,
          `Closed depended issues:
${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
        );
      }
    }
  };
}
