import { mock } from 'jest-mock-extended';
import type { Issue } from '../entities/Issue';
import type {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import {
  DEFAULT_MINIMUM_PULL_REQUEST_AGE_MS,
  StaleTaskPullRequestCloseUseCase,
} from './StaleTaskPullRequestCloseUseCase';

describe('StaleTaskPullRequestCloseUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const useCase = new StaleTaskPullRequestCloseUseCase(mockIssueRepository);

  const asRelatedPullRequest = (issue: Issue): RelatedPullRequest => ({
    url: issue.url,
    branchName: null,
    createdAt: issue.createdAt,
    isDraft: false,
    isConflicted: false,
    mergeable: null,
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isResolvedAllReviewComments: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
    reviewDecision: null,
  });

  // Configures the direct cross-reference-based lookup that replaces the old
  // board-item scan: for each closed task issue URL, findRelatedOpenPRs
  // returns the given candidate pull requests, and getIssueByUrl resolves
  // any of those candidate pull request URLs to their full Issue record.
  const configureDiscovery = (
    closedTaskIssueUrlToCandidatePrs: Record<string, Issue[]>,
  ): void => {
    mockIssueRepository.findRelatedOpenPRs.mockImplementation(
      async (issueUrl: string) =>
        (closedTaskIssueUrlToCandidatePrs[issueUrl] ?? []).map(
          asRelatedPullRequest,
        ),
    );
    const allCandidatePrs = Object.values(
      closedTaskIssueUrlToCandidatePrs,
    ).flat();
    mockIssueRepository.getIssueByUrl.mockImplementation(
      async (url: string) =>
        allCandidatePrs.find((candidatePr) => candidatePr.url === url) ?? null,
    );
  };

  const openTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/1',
    isPr: false,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [],
  };
  const closedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/2',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
  };
  const anotherClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/3',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
  };

  const openPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/100',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [closedTaskIssue.url],
    createdAt: new Date('2020-01-01T00:00:00Z'),
  };
  const openPrWithOpenTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/101',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [openTaskIssue.url],
  };
  const openPrWithoutTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/102',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [],
  };
  const openPrWithUnknownTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/103',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: ['https://github.com/owner/repo/issues/999'],
  };
  const openPrWithClosedAndOpenTaskIssues: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/104',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [closedTaskIssue.url, openTaskIssue.url],
  };
  const closedPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/105',
    isPr: true,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [closedTaskIssue.url],
  };
  const anotherOpenPrWithClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/106',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [anotherClosedTaskIssue.url],
    createdAt: new Date('2020-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(null);
  });

  it('should close an open pull request whose every closing issue reference is a closed task issue', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
    );
  });

  it('should not close a pull request whose closing issue reference is still open', async () => {
    await useCase.run({
      issues: [openTaskIssue, openPrWithOpenTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request that has no closing issue reference', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithoutTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithoutTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request whose closing issue reference is not among the given issues', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithUnknownTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithUnknownTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request when only some of its closing issue references are closed', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithClosedAndOpenTaskIssues],
    });

    await useCase.run({
      issues: [
        closedTaskIssue,
        openTaskIssue,
        openPrWithClosedAndOpenTaskIssues,
      ],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request that is already closed', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [closedPrWithClosedTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, closedPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should continue with the remaining pull requests when closing one of them fails', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
      [anotherClosedTaskIssue.url]: [anotherOpenPrWithClosedTaskIssue],
    });
    mockIssueRepository.closePullRequest.mockRejectedValueOnce(
      new Error('close failed'),
    );

    await useCase.run({
      issues: [
        closedTaskIssue,
        anotherClosedTaskIssue,
        openPrWithClosedTaskIssue,
        anotherOpenPrWithClosedTaskIssue,
      ],
    });

    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      anotherOpenPrWithClosedTaskIssue.url,
    );
  });

  it('should post a comment with the closed task issue URLs when closing a stale pull request', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
      expect.stringContaining(closedTaskIssue.url),
    );
  });

  it('should post a comment before closing the pull request', async () => {
    configureDiscovery({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
    });
    const callOrder: string[] = [];
    mockIssueRepository.createCommentByUrl.mockImplementation(async () => {
      callOrder.push('comment');
      return {
        author: '',
        body: '',
        createdAt: new Date(),
        url: 'https://github.com/o/r/pull/1#issuecomment-1',
      };
    });
    mockIssueRepository.closePullRequest.mockImplementation(async () => {
      callOrder.push('close');
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithClosedTaskIssue],
    });

    expect(callOrder).toEqual(['comment', 'close']);
  });

  describe('minimum pull request age guard', () => {
    const evaluatedAt = new Date('2026-01-02T00:00:00Z');
    const MINUTE_MS = 60 * 1000;
    const HOUR_MS = 60 * MINUTE_MS;

    const testCases: {
      name: string;
      pullRequestAgeMs: number;
      referencedIssueIsClosed: boolean | null;
      expectClosePullRequestCalled: boolean;
      minimumPullRequestAgeMs?: number;
    }[] = [
      {
        name: '10 minutes old with 1 closed referenced issue',
        pullRequestAgeMs: 10 * MINUTE_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: false,
      },
      {
        name: '23 hours 59 minutes old with 1 closed referenced issue',
        pullRequestAgeMs: 23 * HOUR_MS + 59 * MINUTE_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: false,
      },
      {
        name: '24 hours old exactly with 1 closed referenced issue',
        pullRequestAgeMs: 24 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: true,
      },
      {
        name: '48 hours old with 1 closed referenced issue',
        pullRequestAgeMs: 48 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: true,
      },
      {
        name: '10 minutes old with 1 open referenced issue',
        pullRequestAgeMs: 10 * MINUTE_MS,
        referencedIssueIsClosed: false,
        expectClosePullRequestCalled: false,
      },
      {
        name: '48 hours old with 1 open referenced issue',
        pullRequestAgeMs: 48 * HOUR_MS,
        referencedIssueIsClosed: false,
        expectClosePullRequestCalled: false,
      },
      {
        name: '48 hours old with 0 referenced issues',
        pullRequestAgeMs: 48 * HOUR_MS,
        referencedIssueIsClosed: null,
        expectClosePullRequestCalled: false,
      },
      {
        name: '30 minutes old with 1 closed referenced issue and a 1 hour minimumPullRequestAgeMs override',
        pullRequestAgeMs: 30 * MINUTE_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: false,
        minimumPullRequestAgeMs: 1 * HOUR_MS,
      },
      {
        name: '1 hour old exactly with 1 closed referenced issue and a 1 hour minimumPullRequestAgeMs override',
        pullRequestAgeMs: 1 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: true,
        minimumPullRequestAgeMs: 1 * HOUR_MS,
      },
      {
        name: '2 hours old with 1 closed referenced issue and a 1 hour minimumPullRequestAgeMs override',
        pullRequestAgeMs: 2 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: true,
        minimumPullRequestAgeMs: 1 * HOUR_MS,
      },
      {
        name: '30 hours old with 1 closed referenced issue and a 48 hour minimumPullRequestAgeMs override',
        pullRequestAgeMs: 30 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: false,
        minimumPullRequestAgeMs: 48 * HOUR_MS,
      },
      {
        name: '50 hours old with 1 closed referenced issue and a 48 hour minimumPullRequestAgeMs override',
        pullRequestAgeMs: 50 * HOUR_MS,
        referencedIssueIsClosed: true,
        expectClosePullRequestCalled: true,
        minimumPullRequestAgeMs: 48 * HOUR_MS,
      },
    ];

    testCases.forEach((testCase) => {
      it(`should ${testCase.expectClosePullRequestCalled ? '' : 'not '}call closePullRequest when the pull request is ${testCase.name}`, async () => {
        const referencedTaskIssue: Issue | null =
          testCase.referencedIssueIsClosed === null
            ? null
            : {
                ...mock<Issue>(),
                url: 'https://github.com/owner/repo/issues/200',
                isPr: false,
                isClosed: testCase.referencedIssueIsClosed,
                state: testCase.referencedIssueIsClosed ? 'CLOSED' : 'OPEN',
                closingIssueReferenceUrls: [],
              };
        const targetPullRequest: Issue = {
          ...mock<Issue>(),
          url: 'https://github.com/owner/repo/pull/200',
          isPr: true,
          isClosed: false,
          state: 'OPEN',
          closingIssueReferenceUrls: referencedTaskIssue
            ? [referencedTaskIssue.url]
            : [],
          createdAt: new Date(
            evaluatedAt.getTime() - testCase.pullRequestAgeMs,
          ),
        };

        if (referencedTaskIssue && referencedTaskIssue.isClosed) {
          configureDiscovery({
            [referencedTaskIssue.url]: [targetPullRequest],
          });
        }

        await useCase.run({
          issues: referencedTaskIssue
            ? [referencedTaskIssue, targetPullRequest]
            : [targetPullRequest],
          evaluatedAt,
          ...(testCase.minimumPullRequestAgeMs !== undefined
            ? { minimumPullRequestAgeMs: testCase.minimumPullRequestAgeMs }
            : {}),
        });

        if (testCase.expectClosePullRequestCalled) {
          expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
            targetPullRequest.url,
          );
        } else {
          expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
        }
      });
    });
  });

  // Test table 2 — stale-pull-request-close discovery decision:
  // | Task issue state | Open PR linked to it (via direct lookup) | PR already a board card | Result                                            |
  // | Closed            | Yes, age >= minimum threshold             | No                       | The tool closes the PR (found via direct lookup)  |
  // | Closed            | Yes, age >= minimum threshold             | Yes (leftover card)     | The tool closes the PR (unchanged outcome)        |
  // | Closed            | Yes, age below the minimum threshold      | No                       | The tool leaves the PR open (unchanged)           |
  // | Open              | Yes                                       | No                       | The tool leaves the PR open (unchanged)           |
  describe('stale-pull-request-close discovery decision (test table 2)', () => {
    const discoveryEvaluatedAt = new Date('2026-01-02T00:00:00Z');
    const AT_MINIMUM_AGE_MS = DEFAULT_MINIMUM_PULL_REQUEST_AGE_MS;
    const BELOW_MINIMUM_AGE_MS = DEFAULT_MINIMUM_PULL_REQUEST_AGE_MS - 60_000;

    const tableTestCases: {
      name: string;
      taskIssue: Issue;
      pullRequestAgeMs: number;
      pullRequestIsAlreadyBoardCard: boolean;
      expectClosePullRequestCalled: boolean;
    }[] = [
      {
        name: 'row 1: closed task issue, open PR at/above the minimum age, not already a board card => the PR is closed via direct lookup alone',
        taskIssue: closedTaskIssue,
        pullRequestAgeMs: AT_MINIMUM_AGE_MS,
        pullRequestIsAlreadyBoardCard: false,
        expectClosePullRequestCalled: true,
      },
      {
        name: 'row 2: closed task issue, open PR at/above the minimum age, already a leftover board card => the PR is still closed (unchanged outcome)',
        taskIssue: closedTaskIssue,
        pullRequestAgeMs: AT_MINIMUM_AGE_MS,
        pullRequestIsAlreadyBoardCard: true,
        expectClosePullRequestCalled: true,
      },
      {
        name: 'row 3: closed task issue, open PR below the minimum age, not already a board card => the PR is left open',
        taskIssue: closedTaskIssue,
        pullRequestAgeMs: BELOW_MINIMUM_AGE_MS,
        pullRequestIsAlreadyBoardCard: false,
        expectClosePullRequestCalled: false,
      },
      {
        name: 'row 4: open task issue, open PR linked to it, not already a board card => the PR is left open',
        taskIssue: openTaskIssue,
        pullRequestAgeMs: AT_MINIMUM_AGE_MS,
        pullRequestIsAlreadyBoardCard: false,
        expectClosePullRequestCalled: false,
      },
    ];

    tableTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const candidatePullRequest: Issue = {
          ...mock<Issue>(),
          url: 'https://github.com/owner/repo/pull/300',
          isPr: true,
          isClosed: false,
          state: 'OPEN',
          closingIssueReferenceUrls: [testCase.taskIssue.url],
          createdAt: new Date(
            discoveryEvaluatedAt.getTime() - testCase.pullRequestAgeMs,
          ),
        };

        configureDiscovery({
          [testCase.taskIssue.url]: [candidatePullRequest],
        });

        const issuesInput: Issue[] = testCase.pullRequestIsAlreadyBoardCard
          ? [testCase.taskIssue, candidatePullRequest]
          : [testCase.taskIssue];

        await useCase.run({
          issues: issuesInput,
          evaluatedAt: discoveryEvaluatedAt,
        });

        if (testCase.expectClosePullRequestCalled) {
          expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
            candidatePullRequest.url,
          );
        } else {
          expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
        }
      });
    });
  });
});
