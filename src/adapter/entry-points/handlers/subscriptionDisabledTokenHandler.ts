import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { SubscriptionDisabledIssueUseCase } from '../../../domain/usecases/SubscriptionDisabledIssueUseCase';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import { readRateLimit } from '../../proxy/RateLimitCache';

export type SubscriptionDisabledTokenHandlerParams = {
  tokenListJsonPath: string | null;
  org: string;
  repo: string;
  issueRepository: Pick<
    IssueRepository,
    'searchIssue' | 'createNewIssue' | 'createCommentByUrl'
  >;
};

export const handleSubscriptionDisabledTokens = async (
  params: SubscriptionDisabledTokenHandlerParams,
): Promise<void> => {
  const { tokenListJsonPath, org, repo, issueRepository } = params;

  if (tokenListJsonPath === null) {
    return;
  }

  const entries = loadTokenEntries(tokenListJsonPath);
  if (entries === null) {
    return;
  }

  const tokenEntries = entries.map((entry) => ({
    name: entry.name,
    subscriptionDisabled:
      readRateLimit(entry.token)?.subscriptionDisabled ?? false,
  }));

  await new SubscriptionDisabledIssueUseCase(issueRepository).run({
    tokenEntries,
    org,
    repo,
  });
};
