export type ConsoleGithubTokenResolver = (repositoryOwner: string) => string;

export const extractRepositoryOwner = (
  issueOrPullRequestUrl: string,
): string | null => {
  const match = issueOrPullRequestUrl.match(
    /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+\/(?:issues|pull)\/\d+/,
  );
  return match ? match[1] : null;
};

export const createConsoleIssueRepositoryResolver = <IssueRepositoryType>(
  resolveGithubToken: ConsoleGithubTokenResolver,
  buildIssueRepositoryForToken: (githubToken: string) => IssueRepositoryType,
): ((issueOrPullRequestUrl: string) => IssueRepositoryType) => {
  return (issueOrPullRequestUrl: string): IssueRepositoryType => {
    const repositoryOwner = extractRepositoryOwner(issueOrPullRequestUrl);
    if (repositoryOwner === null) {
      throw new Error(
        `The repository owner cannot be read from the operated url: ${issueOrPullRequestUrl}`,
      );
    }
    return buildIssueRepositoryForToken(resolveGithubToken(repositoryOwner));
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
    const owner = extractRepositoryOwner(itemUrl);
    if (owner === null) {
      throw new Error(
        `The repository owner cannot be read from the url: ${itemUrl}`,
      );
    }
    return resolveGithubToken(owner);
  };
};

export const createConsoleGithubTokenResolver = (
  defaultToken: string,
  consoleProjectUrls: Record<string, string> | null,
  consoleGithubTokens: Record<string, string> | null,
): ConsoleGithubTokenResolver => {
  const resolvedTokenByRepositoryOwner = new Map<string, string>();
  return (repositoryOwner: string): string => {
    const alreadyResolved = resolvedTokenByRepositoryOwner.get(repositoryOwner);
    if (alreadyResolved !== undefined) {
      return alreadyResolved;
    }
    if (consoleProjectUrls === null || consoleGithubTokens === null) {
      return defaultToken;
    }
    const normalizedOwner = repositoryOwner.toLowerCase();
    const matchedPjcode = Object.entries(consoleProjectUrls).find(
      ([, projectUrl]) =>
        extractProjectOwner(projectUrl)?.toLowerCase() === normalizedOwner,
    )?.[0];
    if (matchedPjcode === undefined) {
      return defaultToken;
    }
    const token = consoleGithubTokens[matchedPjcode];
    if (token === undefined || token.trim().length === 0) {
      throw new Error(
        `The GitHub token for pjcode "${matchedPjcode}" is not configured: set consoleGithubTokens.${matchedPjcode} in the console config file`,
      );
    }
    const trimmedToken = token.trim();
    resolvedTokenByRepositoryOwner.set(repositoryOwner, trimmedToken);
    return trimmedToken;
  };
};
