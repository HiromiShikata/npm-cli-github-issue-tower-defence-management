import type { IssueRepository } from './adapter-interfaces/IssueRepository';

export class IssueCloseOutcomeConfirmUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'closeIssueByUrl' | 'getIssueOrPullRequestState'
    >,
  ) {}

  run = async (
    issueUrl: string,
    stateReason: 'completed' | 'not_planned',
  ): Promise<void> => {
    try {
      await this.issueRepository.closeIssueByUrl(issueUrl, stateReason);
    } catch (closeError) {
      try {
        const observedState =
          await this.issueRepository.getIssueOrPullRequestState(issueUrl);
        if (
          observedState.state === 'closed' &&
          observedState.stateReason === stateReason
        ) {
          return;
        }
      } catch {
        throw closeError;
      }
      throw closeError;
    }
  };
}
