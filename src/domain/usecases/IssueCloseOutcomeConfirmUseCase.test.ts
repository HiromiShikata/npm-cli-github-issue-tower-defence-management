import type { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCloseOutcomeConfirmUseCase } from './IssueCloseOutcomeConfirmUseCase';

type CloseRepository = Pick<
  IssueRepository,
  'closeIssueByUrl' | 'getIssueOrPullRequestState'
>;
type StateReason = Parameters<CloseRepository['closeIssueByUrl']>[1];
type ObservedIssueState = Awaited<
  ReturnType<CloseRepository['getIssueOrPullRequestState']>
>;

class InMemoryCloseRepository implements CloseRepository {
  readonly closeCalls: { issueUrl: string; stateReason: StateReason }[] = [];
  readonly readCalls: string[] = [];
  readonly operations: string[] = [];

  constructor(
    private readonly closeError: Error | null,
    private readonly observedState: ObservedIssueState,
    private readonly readError: Error | null = null,
  ) {}

  async closeIssueByUrl(
    issueUrl: string,
    stateReason: StateReason,
  ): Promise<void> {
    this.closeCalls.push({ issueUrl, stateReason });
    this.operations.push('close');
    if (this.closeError !== null) {
      throw this.closeError;
    }
  }

  async getIssueOrPullRequestState(
    issueUrl: string,
  ): Promise<ObservedIssueState> {
    this.readCalls.push(issueUrl);
    this.operations.push('read');
    if (this.readError !== null) {
      throw this.readError;
    }
    return this.observedState;
  }
}

const issueUrl = 'https://github.com/o/r/issues/1';
const requestedReasons: StateReason[] = ['completed', 'not_planned'];
const observedState = (
  state: string,
  stateReason: string,
): ObservedIssueState => ({
  state,
  stateReason,
  merged: false,
  isPullRequest: false,
  title: 'Issue close outcome',
});

describe('IssueCloseOutcomeConfirmUseCase', () => {
  it.each(requestedReasons)(
    'does not read state after a successful close as %s',
    async (stateReason) => {
      const repository = new InMemoryCloseRepository(
        null,
        observedState('open', ''),
      );

      await expect(
        new IssueCloseOutcomeConfirmUseCase(repository).run(
          issueUrl,
          stateReason,
        ),
      ).resolves.toBeUndefined();

      expect(repository.closeCalls).toEqual([{ issueUrl, stateReason }]);
      expect(repository.readCalls).toEqual([]);
      expect(repository.operations).toEqual(['close']);
    },
  );

  it.each(requestedReasons)(
    'confirms the requested closed state after a failed close response: %s',
    async (stateReason) => {
      const repository = new InMemoryCloseRepository(
        new Error('HTTP 502: close response failed'),
        observedState('closed', stateReason),
      );

      await expect(
        new IssueCloseOutcomeConfirmUseCase(repository).run(
          issueUrl,
          stateReason,
        ),
      ).resolves.toBeUndefined();

      expect(repository.closeCalls).toEqual([{ issueUrl, stateReason }]);
      expect(repository.readCalls).toEqual([issueUrl]);
      expect(repository.operations).toEqual(['close', 'read']);
    },
  );

  it.each(
    requestedReasons.flatMap((stateReason) =>
      [
        observedState('open', stateReason),
        observedState('open', ''),
        observedState('closed', ''),
        observedState(
          'closed',
          stateReason === 'completed' ? 'not_planned' : 'completed',
        ),
      ].map((actualState) => ({ stateReason, actualState })),
    ),
  )(
    'rethrows the original close error for requested $stateReason and observed $actualState',
    async ({ stateReason, actualState }) => {
      const closeError = new Error('HTTP 502: close response failed');
      const repository = new InMemoryCloseRepository(closeError, actualState);

      await expect(
        new IssueCloseOutcomeConfirmUseCase(repository).run(
          issueUrl,
          stateReason,
        ),
      ).rejects.toBe(closeError);

      expect(repository.closeCalls).toEqual([{ issueUrl, stateReason }]);
      expect(repository.readCalls).toEqual([issueUrl]);
      expect(repository.operations).toEqual(['close', 'read']);
    },
  );

  it.each(requestedReasons)(
    'preserves the original close error when read-back fails for %s',
    async (stateReason) => {
      const closeError = new Error('HTTP 502: close response failed');
      const repository = new InMemoryCloseRepository(
        closeError,
        observedState('closed', stateReason),
        new Error('read-back failed'),
      );

      await expect(
        new IssueCloseOutcomeConfirmUseCase(repository).run(
          issueUrl,
          stateReason,
        ),
      ).rejects.toBe(closeError);

      expect(repository.closeCalls).toEqual([{ issueUrl, stateReason }]);
      expect(repository.readCalls).toEqual([issueUrl]);
      expect(repository.operations).toEqual(['close', 'read']);
    },
  );
});
