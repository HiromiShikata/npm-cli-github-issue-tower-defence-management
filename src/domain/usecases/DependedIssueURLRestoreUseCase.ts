import { Issue } from '../entities/Issue';
import {
  IssueComment,
  IssueRepository,
} from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
} from './dependencyNotificationCommentHeads';

type ClearCause = 'icebox' | 'closed' | 'circular' | 'restored';

type RelevantComment = {
  id: number;
  createdAt: Date;
  cause: ClearCause;
  dependedIssueUrls: string[];
};

const ICEBOX_CLEAR_COMMENT_HEADS = [
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
];
const CLOSED_CLEAR_COMMENT_HEADS = [
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
];

/**
 * Restores a "Depended Issue URL separated by comma" project field entry
 * that `ClearDependedIssueURLUseCase` previously removed specifically
 * because the depended issue had entered Icebox status, once that
 * depended issue has since left Icebox and is not closed.
 *
 * A clear caused by the depended issue being closed, or by circular
 * dependency removal, is permanent and is never restored. Which cause
 * applies to a given depended issue URL is determined by the most recent
 * relevant comment on the depending issue that mentions that URL (an
 * Icebox-clear comment, a closed-clear comment, a circular-dependency
 * comment, or a prior restore comment posted by this use case) — an
 * earlier cycle's outcome is superseded by a later one.
 */
export class DependedIssueURLRestoreUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getIssueOrPullRequestComments'
      | 'updateProjectTextField'
      | 'createComment'
    >,
  ) {}

  run = async (input: { project: Project; issues: Issue[] }): Promise<void> => {
    const dependedIssueUrlSeparatedByComma =
      input.project.dependedIssueUrlSeparatedByComma;
    if (!dependedIssueUrlSeparatedByComma) {
      return;
    }
    for (const issue of input.issues) {
      if (issue.isClosed) {
        continue;
      }
      await this.restoreForDependingIssue({
        project: input.project,
        fieldId: dependedIssueUrlSeparatedByComma.fieldId,
        dependingIssue: issue,
        issues: input.issues,
      });
    }
  };

  private restoreForDependingIssue = async (input: {
    project: Project;
    fieldId: string;
    dependingIssue: Issue;
    issues: Issue[];
  }): Promise<void> => {
    const { project, fieldId, dependingIssue, issues } = input;
    const comments = await this.issueRepository.getIssueOrPullRequestComments(
      dependingIssue.url,
    );
    const relevantComments = this.parseRelevantComments(comments);
    if (relevantComments.length === 0) {
      return;
    }
    const latestRelevantCommentByUrl = new Map<string, RelevantComment>();
    for (const comment of relevantComments) {
      for (const url of comment.dependedIssueUrls) {
        latestRelevantCommentByUrl.set(url, comment);
      }
    }
    const restorableDependedIssueUrls = this.findRestorableDependedIssueUrls({
      relevantComments,
      latestRelevantCommentByUrl,
      issues,
    });
    if (restorableDependedIssueUrls.length === 0) {
      return;
    }
    const newlyRestoredDependedIssueUrls = restorableDependedIssueUrls.filter(
      (url) => !dependingIssue.dependedIssueUrls.includes(url),
    );
    const updatedDependedIssueUrls = [
      ...dependingIssue.dependedIssueUrls,
      ...newlyRestoredDependedIssueUrls,
    ];
    await this.issueRepository.updateProjectTextField(
      project,
      fieldId,
      dependingIssue,
      updatedDependedIssueUrls.join(','),
    );
    await this.issueRepository.createComment(
      dependingIssue,
      `${DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD}\n${restorableDependedIssueUrls
        .map((url) => `- ${url}`)
        .join('\n')}`,
    );
  };

  private findRestorableDependedIssueUrls = (input: {
    relevantComments: RelevantComment[];
    latestRelevantCommentByUrl: Map<string, RelevantComment>;
    issues: Issue[];
  }): string[] => {
    const { relevantComments, latestRelevantCommentByUrl, issues } = input;
    const restorableDependedIssueUrls: string[] = [];
    for (const comment of relevantComments) {
      if (comment.cause !== 'icebox') {
        continue;
      }
      for (const url of comment.dependedIssueUrls) {
        if (latestRelevantCommentByUrl.get(url) !== comment) {
          // A later comment (another Icebox clear, a permanent clear, or a
          // prior restore) governs this URL's current state instead.
          continue;
        }
        const dependedIssue = issues.find((candidate) => candidate.url === url);
        if (
          !dependedIssue ||
          dependedIssue.isClosed ||
          dependedIssue.status === ICEBOX_STATUS_NAME
        ) {
          continue;
        }
        restorableDependedIssueUrls.push(url);
      }
    }
    return restorableDependedIssueUrls;
  };

  private parseRelevantComments = (
    comments: IssueComment[],
  ): RelevantComment[] => {
    const relevantComments: RelevantComment[] = [];
    for (const comment of comments) {
      const cause = this.resolveClearCause(comment.body);
      if (!cause) {
        continue;
      }
      relevantComments.push({
        id: comment.id,
        createdAt: comment.createdAt,
        cause,
        dependedIssueUrls: this.extractBulletUrls(comment.body),
      });
    }
    return relevantComments.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
    );
  };

  private resolveClearCause = (commentBody: string): ClearCause | null => {
    if (
      ICEBOX_CLEAR_COMMENT_HEADS.some((head) => commentBody.startsWith(head))
    ) {
      return 'icebox';
    }
    if (
      CLOSED_CLEAR_COMMENT_HEADS.some((head) => commentBody.startsWith(head))
    ) {
      return 'closed';
    }
    if (commentBody.startsWith(CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD)) {
      return 'circular';
    }
    if (commentBody.startsWith(DEPENDED_ISSUE_URL_RESTORED_COMMENT_HEAD)) {
      return 'restored';
    }
    return null;
  };

  private extractBulletUrls = (commentBody: string): string[] =>
    commentBody
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2));
}
