import type { RelatedPullRequest } from './adapter-interfaces/IssueRepository';
import {
  CanonicalPullRequestAdoptionReason,
  canonicalPullRequestSelect,
} from './canonicalPullRequestSelect';

const createRelatedPullRequest = (
  overrides: Pick<RelatedPullRequest, 'url' | 'branchName' | 'createdAt'>,
): RelatedPullRequest => ({
  isDraft: false,
  isConflicted: false,
  mergeable: null,
  isPassedAllCiJob: false,
  isCiStateSuccess: false,
  isResolvedAllReviewComments: false,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  reviewDecision: null,
  ...overrides,
});

const firstOpenedPullRequest = createRelatedPullRequest({
  url: 'https://github.com/user/repo/pull/2169',
  branchName: 'impl/i2161-signal-annotation-prisma-repos',
  createdAt: new Date('2026-09-24T21:45:55Z'),
});
const pullRequestOnLatestSessionBranch = createRelatedPullRequest({
  url: 'https://github.com/user/repo/pull/2186',
  branchName: 'impl-i2161-signal-annotation-prisma-repos',
  createdAt: new Date('2026-09-25T01:14:37Z'),
});
const lastOpenedPullRequest = createRelatedPullRequest({
  url: 'https://github.com/user/repo/pull/2190',
  branchName: 'i2161',
  createdAt: new Date('2026-09-25T02:00:00Z'),
});
const pullRequestWithUnavailableBranch = createRelatedPullRequest({
  url: 'https://github.com/user/repo/pull/2191',
  branchName: null,
  createdAt: new Date('2026-09-25T03:00:00Z'),
});

describe('canonicalPullRequestSelect', () => {
  const testCases: {
    name: string;
    pullRequests: [RelatedPullRequest, ...RelatedPullRequest[]];
    latestSessionBranchName: string | null;
    expectedCanonicalPullRequestUrl: string;
    expectedDuplicatePullRequestUrls: string[];
    expectedAdoptionReason: CanonicalPullRequestAdoptionReason;
  }[] = [
    {
      name: 'adopts the newer pull request whose head branch the latest session has checked out and treats the first-opened one as a duplicate',
      pullRequests: [firstOpenedPullRequest, pullRequestOnLatestSessionBranch],
      latestSessionBranchName: 'impl-i2161-signal-annotation-prisma-repos',
      expectedCanonicalPullRequestUrl: pullRequestOnLatestSessionBranch.url,
      expectedDuplicatePullRequestUrls: [firstOpenedPullRequest.url],
      expectedAdoptionReason: 'LATEST_SESSION_BRANCH',
    },
    {
      name: 'adopts the first-opened pull request when the latest session has that pull request head branch checked out',
      pullRequests: [pullRequestOnLatestSessionBranch, firstOpenedPullRequest],
      latestSessionBranchName: 'impl/i2161-signal-annotation-prisma-repos',
      expectedCanonicalPullRequestUrl: firstOpenedPullRequest.url,
      expectedDuplicatePullRequestUrls: [pullRequestOnLatestSessionBranch.url],
      expectedAdoptionReason: 'LATEST_SESSION_BRANCH',
    },
    {
      name: 'adopts the first-opened pull request when the latest session branch is unknown',
      pullRequests: [pullRequestOnLatestSessionBranch, firstOpenedPullRequest],
      latestSessionBranchName: null,
      expectedCanonicalPullRequestUrl: firstOpenedPullRequest.url,
      expectedDuplicatePullRequestUrls: [pullRequestOnLatestSessionBranch.url],
      expectedAdoptionReason: 'OLDEST_CREATED',
    },
    {
      name: 'adopts the first-opened pull request when the latest session branch is the head branch of no open pull request',
      pullRequests: [pullRequestOnLatestSessionBranch, firstOpenedPullRequest],
      latestSessionBranchName: 'i2161-unpushed',
      expectedCanonicalPullRequestUrl: firstOpenedPullRequest.url,
      expectedDuplicatePullRequestUrls: [pullRequestOnLatestSessionBranch.url],
      expectedAdoptionReason: 'OLDEST_CREATED',
    },
    {
      name: 'lists every pull request other than the adopted one as a duplicate in creation order',
      pullRequests: [
        pullRequestWithUnavailableBranch,
        lastOpenedPullRequest,
        pullRequestOnLatestSessionBranch,
        firstOpenedPullRequest,
      ],
      latestSessionBranchName: 'i2161',
      expectedCanonicalPullRequestUrl: lastOpenedPullRequest.url,
      expectedDuplicatePullRequestUrls: [
        firstOpenedPullRequest.url,
        pullRequestOnLatestSessionBranch.url,
        pullRequestWithUnavailableBranch.url,
      ],
      expectedAdoptionReason: 'LATEST_SESSION_BRANCH',
    },
  ];

  it.each(testCases)(
    '$name',
    ({
      pullRequests,
      latestSessionBranchName,
      expectedCanonicalPullRequestUrl,
      expectedDuplicatePullRequestUrls,
      expectedAdoptionReason,
    }) => {
      const selection = canonicalPullRequestSelect(
        pullRequests,
        latestSessionBranchName,
      );

      expect(selection.canonicalPullRequest.url).toBe(
        expectedCanonicalPullRequestUrl,
      );
      expect(
        selection.duplicatePullRequests.map((pullRequest) => pullRequest.url),
      ).toEqual(expectedDuplicatePullRequestUrls);
      expect(selection.adoptionReason).toBe(expectedAdoptionReason);
    },
  );
});
