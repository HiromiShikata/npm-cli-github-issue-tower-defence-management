import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import {
  IssueRejectionEvaluator,
  PrRejectedReasonType,
} from './IssueRejectionEvaluator';
import { IssueNotFoundError } from './NotifyFinishedIssuePreparationUseCase';

export type IssueReviewReadinessResult = {
  reviewReady: boolean;
  rejections: { type: PrRejectedReasonType; detail: string }[];
};

export class CheckIssueReviewReadinessUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;

  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'get'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'requestChangesWithInlineComment'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
  }

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    labelsAsLlmAgentName?: string[] | null;
  }): Promise<IssueReviewReadinessResult> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const issue = await this.issueRepository.get(params.issueUrl, project);

    if (!issue) {
      throw new IssueNotFoundError(params.issueUrl);
    }

    const { rejections } = await this.issueRejectionEvaluator.evaluate(
      issue,
      params.labelsAsLlmAgentName ?? [],
    );

    return {
      reviewReady: rejections.length === 0,
      rejections,
    };
  };
}
