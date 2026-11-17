import { projectConfigForRepositoryResolve } from '../../../domain/services/projectRepositoryScope';

export type ConsoleGithubTokenResolver = (
  repositoryOwner: string,
  repositoryName?: string,
) => string;

export type ConsoleProjectRepositories = Record<string, string[]>;

export const extractRepositoryOwner = (
  issueOrPullRequestUrl: string,
): string | null => {
  const match = issueOrPullRequestUrl.match(
    /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+\/(?:issues|pull)\/\d+/,
  );
  return match ? match[1] : null;
};

export const extractRepositoryReference = (
  issueOrPullRequestUrl: string,
): { owner: string; repo: string } | null => {
  const match = issueOrPullRequestUrl.match(
    /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(?:issues|pull)\/\d+/,
  );
  return match ? { owner: match[1], repo: match[2] } : null;
};

export const createConsoleIssueRepositoryResolver = <IssueRepositoryType>(
  resolveGithubToken: ConsoleGithubTokenResolver,
  buildIssueRepositoryForToken: (githubToken: string) => IssueRepositoryType,
): ((issueOrPullRequestUrl: string) => IssueRepositoryType) => {
  return (issueOrPullRequestUrl: string): IssueRepositoryType => {
    const reference = extractRepositoryReference(issueOrPullRequestUrl);
    if (reference === null) {
      throw new Error(
        `The repository owner cannot be read from the operated url: ${issueOrPullRequestUrl}`,
      );
    }
    return buildIssueRepositoryForToken(
      resolveGithubToken(reference.owner, reference.repo),
    );
  };
};

export const extractProjectOwner = (projectUrl: string): string | null => {
  const match = projectUrl.match(
    /^https:\/\/github\.com\/(?:orgs|users)\/([A-Za-z0-9._-]+)\/projects\/\d+/,
  );
  return match ? match[1] : null;
};

export const createConsoleProjectRepositoryResolver = <ProjectRepositoryType>(
  resolveGithubToken: ConsoleGithubTokenResolver,
  buildProjectRepositoryForToken: (
    githubToken: string,
  ) => ProjectRepositoryType,
): ((projectUrl: string) => ProjectRepositoryType) => {
  return (projectUrl: string): ProjectRepositoryType => {
    const projectOwner = extractProjectOwner(projectUrl);
    if (projectOwner === null) {
      throw new Error(
        `The project owner cannot be read from the project url: ${projectUrl}`,
      );
    }
    return buildProjectRepositoryForToken(resolveGithubToken(projectOwner));
  };
};

export const createConsoleGithubTokenResolverByItemUrl = (
  resolveGithubToken: ConsoleGithubTokenResolver,
): ((itemUrl: string) => string) => {
  return (itemUrl: string): string => {
    const reference = extractRepositoryReference(itemUrl);
    if (reference === null) {
      throw new Error(
        `The repository owner cannot be read from the url: ${itemUrl}`,
      );
    }
    return resolveGithubToken(reference.owner, reference.repo);
  };
};

export const createConsoleProjectNameResolver = (
  consoleProjectUrls: Record<string, string> | null,
): ((repositoryOwner: string) => string | null) => {
  return (repositoryOwner: string): string | null => {
    if (consoleProjectUrls === null) {
      return null;
    }
    const normalizedOwner = repositoryOwner.toLowerCase();
    return (
      Object.entries(consoleProjectUrls).find(
        ([, projectUrl]) =>
          extractProjectOwner(projectUrl)?.toLowerCase() === normalizedOwner,
      )?.[0] ?? null
    );
  };
};

export const createConsoleRepositoryProjectNameResolver = (
  consoleProjectUrls: Record<string, string> | null,
  consoleProjectRepositories: ConsoleProjectRepositories | null,
): ((repositoryOwner: string, repositoryName: string) => string | null) => {
  return (repositoryOwner: string, repositoryName: string): string | null => {
    if (consoleProjectUrls === null) {
      return null;
    }
    const matched = projectConfigForRepositoryResolve(
      Object.entries(consoleProjectUrls).map(([pjcode, projectUrl]) => ({
        pjcode,
        org: extractProjectOwner(projectUrl) ?? '',
        projectUrl,
        repositories: consoleProjectRepositories?.[pjcode] ?? null,
      })),
      { owner: repositoryOwner, repo: repositoryName },
    );
    return matched?.pjcode ?? null;
  };
};

export const createConsoleGithubTokenResolver = (
  defaultToken: string,
  consoleProjectUrls: Record<string, string> | null,
  consoleGithubTokens: Record<string, string> | null,
  consoleProjectRepositories: ConsoleProjectRepositories | null = null,
): ConsoleGithubTokenResolver => {
  const resolvedTokenByRepositoryKey = new Map<string, string>();
  const resolveProjectName =
    createConsoleProjectNameResolver(consoleProjectUrls);
  const resolveRepositoryProjectName =
    createConsoleRepositoryProjectNameResolver(
      consoleProjectUrls,
      consoleProjectRepositories,
    );
  return (repositoryOwner: string, repositoryName?: string): string => {
    const cacheKey =
      repositoryName === undefined
        ? repositoryOwner
        : `${repositoryOwner}/${repositoryName}`;
    const alreadyResolved = resolvedTokenByRepositoryKey.get(cacheKey);
    if (alreadyResolved !== undefined) {
      return alreadyResolved;
    }
    if (consoleProjectUrls === null || consoleGithubTokens === null) {
      return defaultToken;
    }
    const matchedPjcode =
      repositoryName === undefined
        ? resolveProjectName(repositoryOwner)
        : resolveRepositoryProjectName(repositoryOwner, repositoryName);
    if (matchedPjcode === null) {
      return defaultToken;
    }
    const token = consoleGithubTokens[matchedPjcode];
    if (token === undefined || token.trim().length === 0) {
      throw new Error(
        `The GitHub token for pjcode "${matchedPjcode}" is not configured: set consoleGithubTokens.${matchedPjcode} in the console config file`,
      );
    }
    const trimmedToken = token.trim();
    resolvedTokenByRepositoryKey.set(cacheKey, trimmedToken);
    return trimmedToken;
  };
};
