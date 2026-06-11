import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import {
  IssueRejectionEvaluator,
  PrRejectedReasonType,
} from './IssueRejectionEvaluator';

type RejectedReasonType =
  | 'ISSUE_NOT_FOUND'
  | 'NO_REPORT_FROM_AGENT_BOT'
  | 'REPORT_HAS_NEXT_STEP'
  | PrRejectedReasonType;

export type IssueReviewReadinessResult = {
  reviewReady: boolean;
  rejections: { type: RejectedReasonType; detail: string }[];
};

export class CheckIssueReviewReadinessUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;

  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getIssueByUrl'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'requestChangesWithInlineComment'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
  }

  run = async (params: {
    issueUrl: string;
    allowedIssueAuthors?: string[] | null;
    labelsAsLlmAgentName?: string[] | null;
  }): Promise<IssueReviewReadinessResult> => {
    const issue = await this.issueRepository.getIssueByUrl(params.issueUrl);

    if (!issue) {
      return {
        reviewReady: false,
        rejections: [
          {
            type: 'ISSUE_NOT_FOUND',
            detail: `Issue not found: ${params.issueUrl}`,
          },
        ],
      };
    }

    const rejections: { type: RejectedReasonType; detail: string }[] = [];

    const comments =
      await this.issueCommentRepository.getCommentsFromIssue(issue);

    const isTrustedAuthor = (author: string): boolean =>
      this.isAuthorTrusted(author, params.allowedIssueAuthors ?? null);

    const lastComment = comments[comments.length - 1];
    if (
      !lastComment ||
      !isTrustedAuthor(lastComment.author) ||
      !lastComment.content.startsWith('From: :robot:')
    ) {
      rejections.push({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    } else if (this.reportBodyHasNextStep(lastComment.content)) {
      rejections.push({
        type: 'REPORT_HAS_NEXT_STEP',
        detail: 'REPORT_HAS_NEXT_STEP',
      });
    }

    const { rejections: prRejections } =
      await this.issueRejectionEvaluator.evaluate(
        issue,
        params.labelsAsLlmAgentName ?? [],
      );

    const allRejections = [...rejections, ...prRejections];

    return {
      reviewReady: allRejections.length === 0,
      rejections: allRejections,
    };
  };

  private isAuthorTrusted = (
    author: string,
    allowedIssueAuthors: string[] | null,
  ): boolean =>
    allowedIssueAuthors === null || allowedIssueAuthors.includes(author);

  private reportBodyHasNextStep = (body: string): boolean => {
    const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
    if (!reportMatch || reportMatch.length < 2) {
      return false;
    }
    let reportJson: unknown;
    try {
      reportJson = JSON.parse(reportMatch[1]);
    } catch (error) {
      console.warn(
        'Invalid JSON in report body while checking nextStep:',
        error,
      );
      return false;
    }
    if (typeof reportJson !== 'object' || reportJson === null) {
      return false;
    }
    if (!('nextStep' in reportJson)) {
      return false;
    }
    const nextStepValue = Reflect.get(reportJson, 'nextStep');
    return nextStepValue !== null && nextStepValue !== undefined;
  };
}
