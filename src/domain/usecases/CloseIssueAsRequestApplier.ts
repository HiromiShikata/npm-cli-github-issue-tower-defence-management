import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { DONE_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueCloseStateReason } from './extractCloseIssueAs';

export type CloseIssueAsRequestApplication =
  | 'notAppliedBecauseClosingPullRequestIsOpen'
  | 'issueClosedAndStatusSetToDone'
  | 'issueClosedWithStatusUnchanged';

export class CloseIssueAsRequestApplier {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'findRelatedOpenPRs' | 'closeIssueByUrl' | 'updateStatus'
    >,
  ) {}

  apply = async (params: {
    issue: Issue;
    project: Project;
    projectUrl: string;
    stateReason: IssueCloseStateReason;
  }): Promise<CloseIssueAsRequestApplication> => {
    const { issue, project, projectUrl, stateReason } = params;
    if (!issue.isClosed) {
      const closingPullRequestUrls = (
        await this.issueRepository.findRelatedOpenPRs(issue.url)
      ).map((pullRequest) => pullRequest.url);
      if (closingPullRequestUrls.length > 0) {
        console.warn(
          `closeIssueAs not applied to ${issue.url} because an open pull request closes it on merge: ${closingPullRequestUrls.join(', ')}`,
        );
        return 'notAppliedBecauseClosingPullRequestIsOpen';
      }
      await this.issueRepository.closeIssueByUrl(issue.url, stateReason);
    }
    const doneStatusOption = project.status.statuses.find(
      (status) => status.name === DONE_STATUS_NAME,
    );
    if (!doneStatusOption) {
      console.error(
        `Done status option '${DONE_STATUS_NAME}' not found in project ${projectUrl}; closed ${issue.url} without changing its Status.`,
      );
      return 'issueClosedWithStatusUnchanged';
    }
    await this.issueRepository.updateStatus(
      project,
      issue,
      doneStatusOption.id,
    );
    return 'issueClosedAndStatusSetToDone';
  };
}
