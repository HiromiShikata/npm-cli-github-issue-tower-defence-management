import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';

export class ClearDependedIssueURLUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      | 'clearProjectField'
      | 'createComment'
      | 'updateProjectTextField'
      | 'getIssueOrPrStateByUrl'
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
      const urlsMissingFromInput = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          !input.issues.some((depIssue) => depIssue.url === dependedIssueUrl),
      );
      const externalUrlStates = new Map<
        string,
        'OPEN' | 'CLOSED' | 'MERGED' | null
      >();
      for (const url of urlsMissingFromInput) {
        const state = await this.issueRepository.getIssueOrPrStateByUrl(url);
        externalUrlStates.set(url, state);
      }
      const notFoundDependedIssueUrls = urlsMissingFromInput.filter(
        (url) => externalUrlStates.get(url) === null,
      );
      const externalOpenDependedIssueUrls = urlsMissingFromInput.filter(
        (url) => externalUrlStates.get(url) === 'OPEN',
      );
      const externalClosedDependedIssueUrls = urlsMissingFromInput.filter(
        (url) => {
          const state = externalUrlStates.get(url);
          return state === 'CLOSED' || state === 'MERGED';
        },
      );
      const remainingDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some(
            (depIssue) =>
              depIssue.url === dependedIssueUrl && !depIssue.isClosed,
          ) || externalOpenDependedIssueUrls.includes(dependedIssueUrl),
      );
      const closedDependedIssueUrls = issue.dependedIssueUrls.filter(
        (dependedIssueUrl) =>
          input.issues.some(
            (depIssue) =>
              depIssue.url === dependedIssueUrl && depIssue.isClosed,
          ) || externalClosedDependedIssueUrls.includes(dependedIssueUrl),
      );
      if (
        notFoundDependedIssueUrls.length === 0 &&
        closedDependedIssueUrls.length === 0
      ) {
        continue;
      }
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
          notFoundDependedIssueUrls.length === 0;
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
    }
  };
}
