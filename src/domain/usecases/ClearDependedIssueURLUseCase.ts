import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDENCY_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
} from './dependencyNotificationCommentHeads';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';
import { isAgentReportBody } from './isAgentReportBody';
import { extractIterationsExhausted } from './extractIterationsExhausted';

export class ClearDependedIssueURLUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      | 'clearProjectField'
      | 'createComment'
      | 'updateProjectTextField'
      | 'getIssueOrPullRequestComments'
      | 'getIssueByUrl'
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
    for (const issue of input.issues) {
      if (issue.dependedIssueUrls.length <= 0 || issue.isClosed) {
        continue;
      }
      await this.removeResolvedDependedIssueUrlsFromIssue({
        project: input.project,
        issues: input.issues,
        allowedExternalRepoNameWithOwner:
          input.allowedExternalRepoNameWithOwner,
        dependedIssueUrlSeparatedByComma,
        issue,
        absentDependedIssueIsResolvable: !input.cacheUsed,
      });
    }
  };

  removeResolvedDependedIssueUrlsFromIssuesWithClosedDependedIssue =
    async (input: { project: Project; issues: Issue[] }): Promise<void> => {
      const dependedIssueUrlSeparatedByComma =
        input.project.dependedIssueUrlSeparatedByComma;
      if (!dependedIssueUrlSeparatedByComma) {
        return;
      }
      const closedIssueUrls = new Set(
        input.issues
          .filter((issue) => issue.isClosed)
          .map((issue) => issue.url),
      );
      const failedIssueDescriptions: string[] = [];
      for (const issue of input.issues) {
        if (
          issue.isClosed ||
          !issue.dependedIssueUrls.some((dependedIssueUrl) =>
            closedIssueUrls.has(dependedIssueUrl),
          )
        ) {
          continue;
        }
        try {
          await this.removeResolvedDependedIssueUrlsFromIssue({
            project: input.project,
            issues: input.issues,
            allowedExternalRepoNameWithOwner: null,
            dependedIssueUrlSeparatedByComma,
            issue,
            absentDependedIssueIsResolvable: false,
          });
        } catch (error) {
          failedIssueDescriptions.push(
            `${issue.url}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (failedIssueDescriptions.length > 0) {
        throw new Error(
          `Failed to remove resolved depended issue URLs from ${failedIssueDescriptions.length} issue(s): ${failedIssueDescriptions.join('; ')}`,
        );
      }
    };

  private removeResolvedDependedIssueUrlsFromIssue = async (input: {
    project: Project;
    issues: Issue[];
    allowedExternalRepoNameWithOwner?: string | null;
    dependedIssueUrlSeparatedByComma: NonNullable<
      Project['dependedIssueUrlSeparatedByComma']
    >;
    issue: Issue;
    absentDependedIssueIsResolvable: boolean;
  }): Promise<void> => {
    const {
      dependedIssueUrlSeparatedByComma,
      issue,
      absentDependedIssueIsResolvable,
    } = input;
    const circularDependedIssueUrls = absentDependedIssueIsResolvable
      ? this.findCircularDependedIssueUrls(issue, input.issues)
      : [];
    if (circularDependedIssueUrls.length > 0) {
      await this.issueRepository.clearProjectField(
        input.project,
        dependedIssueUrlSeparatedByComma.fieldId,
        issue,
      );
      await this.createCommentWithDedup(
        issue,
        `${CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD}\n${circularDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
      );
      return;
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
    const absentFromProjectIssuesDependedIssueUrls =
      absentDependedIssueIsResolvable
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
    const liveConfirmedOpenSameRepoDependedIssueUrls =
      absentDependedIssueIsResolvable
        ? await this.findLiveConfirmedOpenSameRepoDependedIssueUrls(
            issue,
            absentFromProjectIssuesDependedIssueUrls,
          )
        : [];
    const rawNotFoundDependedIssueUrls =
      absentFromProjectIssuesDependedIssueUrls.filter(
        (dependedIssueUrl) =>
          !liveConfirmedOpenSameRepoDependedIssueUrls.includes(
            dependedIssueUrl,
          ),
      );
    const iterationsExhaustedPreservesNotFound =
      rawNotFoundDependedIssueUrls.length > 0 &&
      (await this.lastAgentReportHasIterationsExhausted(issue.url));
    const notFoundDependedIssueUrls = iterationsExhaustedPreservesNotFound
      ? []
      : rawNotFoundDependedIssueUrls;
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
          (depIssue) => depIssue.url === dependedIssueUrl && depIssue.isClosed,
        ),
    );
    if (
      notFoundDependedIssueUrls.length === 0 &&
      closedDependedIssueUrls.length === 0 &&
      iceboxDependedIssueUrls.length === 0
    ) {
      return;
    }
    const remainingDependedIssueUrls = absentDependedIssueIsResolvable
      ? [
          ...openDependedIssueUrls,
          ...allowedExternalDependedIssueUrls,
          ...liveConfirmedOpenSameRepoDependedIssueUrls,
          ...(iterationsExhaustedPreservesNotFound
            ? rawNotFoundDependedIssueUrls
            : []),
        ]
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
      await this.createCommentWithDedup(
        issue,
        `${allCleared ? ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD : SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD}\n${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
      );
    }
    if (notFoundDependedIssueUrls.length > 0) {
      await this.createCommentWithDedup(
        issue,
        `${DEPENDENCY_REMOVED_COMMENT_HEAD}\n${notFoundDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
      );
    }
    if (iceboxDependedIssueUrls.length > 0) {
      const iceboxAllCleared =
        remainingDependedIssueUrls.length === 0 &&
        closedDependedIssueUrls.length === 0 &&
        notFoundDependedIssueUrls.length === 0;
      await this.createCommentWithDedup(
        issue,
        `${iceboxAllCleared ? ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD : SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD}\n${iceboxDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
      );
    }
  };

  private isSameRepoDependedIssueUrl = (
    issue: Issue,
    dependedIssueUrl: string,
  ): boolean =>
    dependedIssueUrl.startsWith(
      `https://github.com/${issue.org}/${issue.repo}/`,
    );

  private findLiveConfirmedOpenSameRepoDependedIssueUrls = async (
    issue: Issue,
    absentFromProjectIssuesDependedIssueUrls: string[],
  ): Promise<string[]> => {
    const sameRepoDependedIssueUrls =
      absentFromProjectIssuesDependedIssueUrls.filter((dependedIssueUrl) =>
        this.isSameRepoDependedIssueUrl(issue, dependedIssueUrl),
      );
    if (sameRepoDependedIssueUrls.length === 0) {
      return [];
    }
    const liveCheckedIssues = await Promise.all(
      sameRepoDependedIssueUrls.map((dependedIssueUrl) =>
        this.issueRepository.getIssueByUrl(dependedIssueUrl),
      ),
    );
    return sameRepoDependedIssueUrls.filter((_dependedIssueUrl, index) => {
      const liveCheckedIssue = liveCheckedIssues[index];
      return liveCheckedIssue !== null && !liveCheckedIssue.isClosed;
    });
  };

  private lastAgentReportHasIterationsExhausted = async (
    issueUrl: string,
  ): Promise<boolean> => {
    const comments =
      await this.issueRepository.getIssueOrPullRequestComments(issueUrl);
    const lastAgentReport = [...comments]
      .reverse()
      .find((comment) => isAgentReportBody(comment.body));
    return lastAgentReport
      ? extractIterationsExhausted(lastAgentReport.body)
      : false;
  };

  private createCommentWithDedup = async (
    issue: Issue,
    commentBody: string,
  ): Promise<void> => {
    const existing = await this.issueRepository.getIssueOrPullRequestComments(
      issue.url,
    );
    if (
      isDuplicateWithinWindow(
        commentBody,
        existing.map((c) => ({ text: c.body, createdAt: c.createdAt })),
        new Date(),
      )
    ) {
      return;
    }
    await this.issueRepository.createComment(issue, commentBody);
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
