import type { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

export type CanonicalPullRequestAdoptionReason =
  'LATEST_SESSION_BRANCH' | 'OLDEST_CREATED';

export type CanonicalPullRequestSelection = {
  canonicalPullRequest: RelatedPullRequest;
  duplicatePullRequests: RelatedPullRequest[];
  adoptionReason: CanonicalPullRequestAdoptionReason;
};

export const canonicalPullRequestSelect = (
  pullRequests: [RelatedPullRequest, ...RelatedPullRequest[]],
  latestSessionBranchName: string | null,
): CanonicalPullRequestSelection => {
  const pullRequestsOldestCreatedFirst = [...pullRequests].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const latestSessionPullRequest =
    latestSessionBranchName === null
      ? null
      : (pullRequestsOldestCreatedFirst.find(
          (pullRequest) => pullRequest.branchName === latestSessionBranchName,
        ) ?? null);
  const canonicalPullRequest =
    latestSessionPullRequest ?? pullRequestsOldestCreatedFirst[0];
  return {
    canonicalPullRequest,
    duplicatePullRequests: pullRequestsOldestCreatedFirst.filter(
      (pullRequest) => pullRequest !== canonicalPullRequest,
    ),
    adoptionReason:
      latestSessionPullRequest === null
        ? 'OLDEST_CREATED'
        : 'LATEST_SESSION_BRANCH',
  };
};
