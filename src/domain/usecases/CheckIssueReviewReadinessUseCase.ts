import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import {
  IssueRejectionEvaluator,
  PrRejectedReasonType,
} from './IssueRejectionEvaluator';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import {
  isAgentReportBody,
  isAgentReportBodyFromAgent,
} from './isAgentReportBody';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import { findLastAgentReport } from './findLastAgentReport';

type RejectedReasonType =
  'ISSUE_NOT_FOUND' | 'NO_REPORT_FROM_AGENT_BOT' | PrRejectedReasonType;

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
    labelsNotRequiringPullRequest?: string[] | null;
    developerAgentNames?: string[] | null;
    defaultAgentName?: string | null;
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
      isAuthorAuthorizedForAutoStatusCheck(author, params.allowedIssueAuthors);

    const lastComment = comments[comments.length - 1];
    if (
      !lastComment ||
      !isTrustedAuthor(lastComment.author) ||
      !isAgentReportBody(lastComment.content)
    ) {
      rejections.push({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    }

    const lastAgentReport = findLastAgentReport(comments, isTrustedAuthor);
    const lastReportIsFromDefaultAgent =
      lastAgentReport !== null &&
      params.defaultAgentName != null &&
      isAgentReportBodyFromAgent(
        lastAgentReport.content,
        params.defaultAgentName,
        issue.agent,
      );

    const { rejections: prRejections } =
      await this.issueRejectionEvaluator.evaluate(
        issue,
        resolveLabelsNotRequiringPullRequest(params),
        {
          developerAgentNames: params.developerAgentNames,
        },
      );

    const requiredPrRejections = lastReportIsFromDefaultAgent
      ? prRejections.filter(
          (rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND',
        )
      : prRejections;

    const allRejections = [...rejections, ...requiredPrRejections];

    return {
      reviewReady: allRejections.length === 0,
      rejections: allRejections,
    };
  };
}
