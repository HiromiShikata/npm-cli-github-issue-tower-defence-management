import { mock } from 'jest-mock-extended';
import type { Issue } from '../entities/Issue';
import { DUPLICATE_COMMENT_WINDOW_MS } from '../services/commentDeduplication';
import type {
  IssueComment,
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
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;

  const expectedStaleClosingCommentBody = (
    closingIssueReferenceUrls: string[],
  ): string =>
    `Closing this pull request because all referenced task issues are already closed: ${closingIssueReferenceUrls.join(', ')}`;

  const consoleWarnMessageOfCall = (callIndex: number): string =>
    consoleWarnSpy.mock.calls[callIndex].map(String).join(' ');

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

  const stubRelatedOpenPullRequestLookupsAndGetIssueByUrl = (
    closedTaskIssueUrlToCandidatePrs: Record<string, Issue[]>,
  ): void => {
    mockIssueRepository.findRelatedOpenPRs.mockImplementation(
      async (issueUrl: string) =>
        (closedTaskIssueUrlToCandidatePrs[issueUrl] ?? []).map(
          asRelatedPullRequest,
        ),
    );
    mockIssueRepository.findRelatedOpenPrUrls.mockImplementation(
      async (issueUrls: string[]) =>
        new Map<string, string[]>(
          issueUrls.map((issueUrl): [string, string[]] => [
            issueUrl,
            (closedTaskIssueUrlToCandidatePrs[issueUrl] ?? []).map(
              (candidatePr) => candidatePr.url,
            ),
          ]),
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
    jest.resetAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should close an open pull request whose every closing issue reference is a closed task issue', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
      [closedTaskIssue.url]: [openPrWithoutTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithoutTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request whose closing issue reference is not among the given issues', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
      [closedTaskIssue.url]: [openPrWithUnknownTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, openPrWithUnknownTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should not close a pull request when only some of its closing issue references are closed', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
      [closedTaskIssue.url]: [closedPrWithClosedTaskIssue],
    });

    await useCase.run({
      issues: [closedTaskIssue, closedPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });

  it('should continue with the remaining pull requests when closing one of them fails', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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

  it('should retry once and succeed when createCommentByUrl first fails with a transient 502 error, backing off via the injected sleep before retrying, then still close the pull request', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
    });
    const mockSleep = jest
      .fn<Promise<void>, [number]>()
      .mockResolvedValue(undefined);
    const retryingUseCase = new StaleTaskPullRequestCloseUseCase(
      mockIssueRepository,
      mockSleep,
    );
    const transientError = Object.assign(
      new Error('Failed to create comment via GitHub REST API: 502 Bad Gateway'),
      { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
    );
    mockIssueRepository.createCommentByUrl
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({
        author: '',
        body: expectedStaleClosingCommentBody([closedTaskIssue.url]),
        createdAt: new Date(),
      });

    await retryingUseCase.run({
      issues: [closedTaskIssue, openPrWithClosedTaskIssue],
    });

    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(2);
    expect(mockSleep).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
    );
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
          stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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

        stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
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

  const thirdClosedTaskIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/issues/4',
    isPr: false,
    isClosed: true,
    state: 'CLOSED',
    closingIssueReferenceUrls: [],
  };
  const openPrWithTwoClosedTaskIssues: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/owner/repo/pull/107',
    isPr: true,
    isClosed: false,
    state: 'OPEN',
    closingIssueReferenceUrls: [
      closedTaskIssue.url,
      anotherClosedTaskIssue.url,
    ],
    createdAt: new Date('2020-01-01T00:00:00Z'),
  };
  const staleEvaluatedAt = new Date('2026-01-02T00:00:00Z');

  describe('stale closing comment posted on a stale pull request', () => {
    const testCases: {
      name: string;
      closedTaskIssues: Issue[];
      stalePullRequest: Issue;
      expectedCommentBody: string;
    }[] = [
      {
        name: 'one closed task issue as its only closing issue reference',
        closedTaskIssues: [closedTaskIssue],
        stalePullRequest: openPrWithClosedTaskIssue,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
        ]),
      },
      {
        name: 'two closed task issues as closing issue references that both return the pull request as related',
        closedTaskIssues: [closedTaskIssue, anotherClosedTaskIssue],
        stalePullRequest: openPrWithTwoClosedTaskIssues,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
          anotherClosedTaskIssue.url,
        ]),
      },
    ];

    testCases.forEach((testCase) => {
      it(`should post the stale closing comment once and close the pull request once when it has ${testCase.name}`, async () => {
        stubRelatedOpenPullRequestLookupsAndGetIssueByUrl(
          Object.fromEntries(
            testCase.closedTaskIssues.map((closedIssue): [string, Issue[]] => [
              closedIssue.url,
              [testCase.stalePullRequest],
            ]),
          ),
        );

        await useCase.run({
          issues: testCase.closedTaskIssues,
          evaluatedAt: staleEvaluatedAt,
        });

        expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
          testCase.stalePullRequest.url,
          testCase.expectedCommentBody,
        );
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
          testCase.stalePullRequest.url,
        );
      });
    });
  });

  it('should neither comment on nor close a related pull request whose details cannot be fetched, and should continue with the remaining pull requests', async () => {
    stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
      [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
      [anotherClosedTaskIssue.url]: [anotherOpenPrWithClosedTaskIssue],
    });
    mockIssueRepository.getIssueByUrl.mockImplementation(async (url: string) =>
      url === anotherOpenPrWithClosedTaskIssue.url
        ? anotherOpenPrWithClosedTaskIssue
        : null,
    );

    await useCase.run({
      issues: [closedTaskIssue, anotherClosedTaskIssue],
      evaluatedAt: staleEvaluatedAt,
    });

    expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
      expect.anything(),
    );
    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalledWith(
      openPrWithClosedTaskIssue.url,
    );
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      anotherOpenPrWithClosedTaskIssue.url,
    );
  });

  describe('failure while posting the stale closing comment or closing the pull request', () => {
    const simulatedFailureMessage = 'simulated GitHub API failure';

    const testCases: {
      name: string;
      arrangeFailureForPullRequestUrl: (failingPullRequestUrl: string) => void;
      expectCloseAttemptedForFailingPullRequest: boolean;
    }[] = [
      {
        name: 'posting the stale closing comment fails',
        arrangeFailureForPullRequestUrl: (failingPullRequestUrl) => {
          mockIssueRepository.createCommentByUrl.mockImplementation(
            async (url: string, commentBody: string) => {
              if (url === failingPullRequestUrl) {
                throw new Error(simulatedFailureMessage);
              }
              return { author: '', body: commentBody, createdAt: new Date() };
            },
          );
        },
        expectCloseAttemptedForFailingPullRequest: false,
      },
      {
        name: 'closing the pull request fails',
        arrangeFailureForPullRequestUrl: (failingPullRequestUrl) => {
          mockIssueRepository.closePullRequest.mockImplementation(
            async (url: string) => {
              if (url === failingPullRequestUrl) {
                throw new Error(simulatedFailureMessage);
              }
            },
          );
        },
        expectCloseAttemptedForFailingPullRequest: true,
      },
    ];

    testCases.forEach((testCase) => {
      it(`should warn once with the pull request URL and the error message and still close the other stale pull request when ${testCase.name}`, async () => {
        stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
          [anotherClosedTaskIssue.url]: [anotherOpenPrWithClosedTaskIssue],
        });
        testCase.arrangeFailureForPullRequestUrl(openPrWithClosedTaskIssue.url);

        await useCase.run({
          issues: [closedTaskIssue, anotherClosedTaskIssue],
          evaluatedAt: staleEvaluatedAt,
        });

        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
          anotherOpenPrWithClosedTaskIssue.url,
        );
        if (testCase.expectCloseAttemptedForFailingPullRequest) {
          expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
            openPrWithClosedTaskIssue.url,
          );
        } else {
          expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalledWith(
            openPrWithClosedTaskIssue.url,
          );
        }
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnMessageOfCall(0)).toContain(
          openPrWithClosedTaskIssue.url,
        );
        expect(consoleWarnMessageOfCall(0)).toContain(simulatedFailureMessage);
      });
    });
  });

  describe('duplicate stale closing comment suppression', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        now: staleEvaluatedAt,
        doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const testCases: {
      name: string;
      existingComment: { body: string; ageMs: number } | null;
      expectCommentPosted: boolean;
    }[] = [
      {
        name: 'the pull request has no comment yet',
        existingComment: null,
        expectCommentPosted: true,
      },
      {
        name: 'the same stale closing comment was posted 1 minute ago',
        existingComment: {
          body: expectedStaleClosingCommentBody([closedTaskIssue.url]),
          ageMs: 60_000,
        },
        expectCommentPosted: false,
      },
      {
        name: 'the same stale closing comment was posted 1 minute before the duplicate comment window starts',
        existingComment: {
          body: expectedStaleClosingCommentBody([closedTaskIssue.url]),
          ageMs: DUPLICATE_COMMENT_WINDOW_MS + 60_000,
        },
        expectCommentPosted: true,
      },
      {
        name: 'a different comment was posted 1 minute ago',
        existingComment: {
          body: 'Unrelated review comment',
          ageMs: 60_000,
        },
        expectCommentPosted: true,
      },
    ];

    testCases.forEach((testCase) => {
      it(`should ${testCase.expectCommentPosted ? '' : 'not '}post the stale closing comment and should still close the pull request when ${testCase.name}`, async () => {
        stubRelatedOpenPullRequestLookupsAndGetIssueByUrl({
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue],
        });
        const existingComments: IssueComment[] =
          testCase.existingComment === null
            ? []
            : [
                {
                  author: 'stale-closing-bot',
                  body: testCase.existingComment.body,
                  createdAt: new Date(
                    staleEvaluatedAt.getTime() - testCase.existingComment.ageMs,
                  ),
                },
              ];
        mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue(
          existingComments,
        );

        await useCase.run({
          issues: [closedTaskIssue],
          evaluatedAt: staleEvaluatedAt,
        });

        if (testCase.expectCommentPosted) {
          expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
            openPrWithClosedTaskIssue.url,
            expectedStaleClosingCommentBody([closedTaskIssue.url]),
          );
        } else {
          expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
        }
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
          openPrWithClosedTaskIssue.url,
        );
      });
    });
  });

  describe('related open pull request lookup for closed task issues', () => {
    const batchClosedTaskIssues: Issue[] = [...Array(250).keys()].map(
      (index): Issue => ({
        ...mock<Issue>(),
        url: `https://github.com/owner/batch-repo/issues/${1000 + index}`,
        isPr: false,
        isClosed: true,
        state: 'CLOSED',
        closingIssueReferenceUrls: [],
      }),
    );

    const testCases: {
      name: string;
      issues: Issue[];
      expectedLookedUpIssueUrls: string[];
    }[] = [
      {
        name: '250 closed task issues mixed with an open task issue, open pull requests and a closed pull request',
        issues: [
          openTaskIssue,
          ...batchClosedTaskIssues.slice(0, 125),
          openPrWithClosedTaskIssue,
          closedPrWithClosedTaskIssue,
          ...batchClosedTaskIssues.slice(125),
          openPrWithOpenTaskIssue,
        ],
        expectedLookedUpIssueUrls: batchClosedTaskIssues.map(
          (batchClosedTaskIssue) => batchClosedTaskIssue.url,
        ),
      },
      {
        name: 'a single closed task issue between an open task issue and an open pull request',
        issues: [openTaskIssue, closedTaskIssue, openPrWithOpenTaskIssue],
        expectedLookedUpIssueUrls: [closedTaskIssue.url],
      },
      {
        name: 'no closed task issue among an open task issue, an open pull request and a closed pull request',
        issues: [
          openTaskIssue,
          openPrWithOpenTaskIssue,
          closedPrWithClosedTaskIssue,
        ],
        expectedLookedUpIssueUrls: [],
      },
    ];

    testCases.forEach((testCase) => {
      it(`should call findRelatedOpenPrUrls exactly once with the closed task issue URLs in input order and never call findRelatedOpenPRs for ${testCase.name}`, async () => {
        await useCase.run({
          issues: testCase.issues,
          evaluatedAt: staleEvaluatedAt,
        });

        expect(mockIssueRepository.findRelatedOpenPrUrls).toHaveBeenCalledTimes(
          1,
        );
        expect(mockIssueRepository.findRelatedOpenPrUrls).toHaveBeenCalledWith(
          testCase.expectedLookedUpIssueUrls,
        );
        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      });
    });
  });

  describe('stale pull request found only through findRelatedOpenPrUrls', () => {
    beforeEach(() => {
      mockIssueRepository.findRelatedOpenPRs.mockReset();
    });

    const testCases: {
      name: string;
      issues: Issue[];
      relatedOpenPrUrlsByIssueUrl: Record<string, string[]>;
      stalePullRequest: Issue;
      expectedCommentBody: string;
    }[] = [
      {
        name: 'the pull request is not among the given issues',
        issues: [closedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
        },
        stalePullRequest: openPrWithClosedTaskIssue,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
        ]),
      },
      {
        name: 'the pull request is also among the given issues',
        issues: [closedTaskIssue, openPrWithClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
        },
        stalePullRequest: openPrWithClosedTaskIssue,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
        ]),
      },
      {
        name: 'the pull request references two closed task issues and is returned for both of them',
        issues: [closedTaskIssue, anotherClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithTwoClosedTaskIssues.url],
          [anotherClosedTaskIssue.url]: [openPrWithTwoClosedTaskIssues.url],
        },
        stalePullRequest: openPrWithTwoClosedTaskIssues,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
          anotherClosedTaskIssue.url,
        ]),
      },
      {
        name: 'the pull request is returned for one closed task issue while another closed task issue has no related open pull request',
        issues: [closedTaskIssue, anotherClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
          [anotherClosedTaskIssue.url]: [],
        },
        stalePullRequest: openPrWithClosedTaskIssue,
        expectedCommentBody: expectedStaleClosingCommentBody([
          closedTaskIssue.url,
        ]),
      },
    ];

    testCases.forEach((testCase) => {
      it(`should post the stale closing comment and close the pull request when ${testCase.name}`, async () => {
        mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(
          new Map(Object.entries(testCase.relatedOpenPrUrlsByIssueUrl)),
        );
        mockIssueRepository.getIssueByUrl.mockImplementation(
          async (url: string) =>
            url === testCase.stalePullRequest.url
              ? testCase.stalePullRequest
              : null,
        );

        await expect(
          useCase.run({
            issues: testCase.issues,
            evaluatedAt: staleEvaluatedAt,
          }),
        ).resolves.toBeUndefined();

        expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
          testCase.stalePullRequest.url,
          testCase.expectedCommentBody,
        );
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(1);
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
          testCase.stalePullRequest.url,
        );
      });
    });
  });

  describe('closed task issues missing from the findRelatedOpenPrUrls result', () => {
    const testCases: {
      name: string;
      issues: Issue[];
      relatedOpenPrUrlsByIssueUrl: Record<string, string[]>;
      expectedMissingIssueUrls: string[];
      expectedClosedPullRequestUrls: string[];
    }[] = [
      {
        name: 'one of two closed task issues is missing',
        issues: [closedTaskIssue, anotherClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
        },
        expectedMissingIssueUrls: [anotherClosedTaskIssue.url],
        expectedClosedPullRequestUrls: [openPrWithClosedTaskIssue.url],
      },
      {
        name: 'two of three closed task issues are missing',
        issues: [closedTaskIssue, anotherClosedTaskIssue, thirdClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
        },
        expectedMissingIssueUrls: [
          anotherClosedTaskIssue.url,
          thirdClosedTaskIssue.url,
        ],
        expectedClosedPullRequestUrls: [openPrWithClosedTaskIssue.url],
      },
      {
        name: 'every closed task issue is missing',
        issues: [closedTaskIssue, anotherClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {},
        expectedMissingIssueUrls: [
          closedTaskIssue.url,
          anotherClosedTaskIssue.url,
        ],
        expectedClosedPullRequestUrls: [],
      },
      {
        name: 'no closed task issue is missing',
        issues: [closedTaskIssue, anotherClosedTaskIssue],
        relatedOpenPrUrlsByIssueUrl: {
          [closedTaskIssue.url]: [openPrWithClosedTaskIssue.url],
          [anotherClosedTaskIssue.url]: [anotherOpenPrWithClosedTaskIssue.url],
        },
        expectedMissingIssueUrls: [],
        expectedClosedPullRequestUrls: [
          openPrWithClosedTaskIssue.url,
          anotherOpenPrWithClosedTaskIssue.url,
        ],
      },
    ];

    testCases.forEach((testCase) => {
      it(`should never call findRelatedOpenPRs, should ${testCase.expectedMissingIssueUrls.length === 0 ? 'not warn' : 'warn once with every missing closed task issue URL'}, and should close the stale pull requests returned for the other closed task issues when ${testCase.name}`, async () => {
        mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(
          new Map(Object.entries(testCase.relatedOpenPrUrlsByIssueUrl)),
        );
        mockIssueRepository.getIssueByUrl.mockImplementation(
          async (url: string) =>
            [openPrWithClosedTaskIssue, anotherOpenPrWithClosedTaskIssue].find(
              (candidatePr) => candidatePr.url === url,
            ) ?? null,
        );

        await useCase.run({
          issues: testCase.issues,
          evaluatedAt: staleEvaluatedAt,
        });

        expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
        if (testCase.expectedMissingIssueUrls.length === 0) {
          expect(consoleWarnSpy).not.toHaveBeenCalled();
        } else {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          testCase.expectedMissingIssueUrls.forEach((missingIssueUrl) => {
            expect(consoleWarnMessageOfCall(0)).toContain(missingIssueUrl);
          });
        }
        expect(mockIssueRepository.closePullRequest).toHaveBeenCalledTimes(
          testCase.expectedClosedPullRequestUrls.length,
        );
        testCase.expectedClosedPullRequestUrls.forEach(
          (expectedClosedPullRequestUrl) => {
            expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
              expectedClosedPullRequestUrl,
            );
          },
        );
      });
    });
  });

  it('should not warn and should treat the closed task issue as resolved with no candidate pull request when findRelatedOpenPrUrls returns an empty array for it', async () => {
    mockIssueRepository.findRelatedOpenPrUrls.mockResolvedValue(
      new Map([[closedTaskIssue.url, []]]),
    );

    await useCase.run({
      issues: [closedTaskIssue],
      evaluatedAt: staleEvaluatedAt,
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockIssueRepository.getIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalled();
  });
});
