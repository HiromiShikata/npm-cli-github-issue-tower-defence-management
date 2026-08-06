export type ConsoleGithubTokenResolver = (repositoryOwner: string) => string;

export type GithubTokenFileReader = (filePath: string) => string;

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

export const createConsoleGithubTokenResolver = (
  defaultToken: string,
  githubTokenFilePathByRepositoryOwner: Record<string, string> | null,
  readTokenFile: GithubTokenFileReader,
): ConsoleGithubTokenResolver => {
  const resolvedTokenByRepositoryOwner = new Map<string, string>();
  return (repositoryOwner: string): string => {
    const alreadyResolved = resolvedTokenByRepositoryOwner.get(repositoryOwner);
    if (alreadyResolved !== undefined) {
      return alreadyResolved;
    }
    const filePath = githubTokenFilePathByRepositoryOwner
      ? githubTokenFilePathByRepositoryOwner[repositoryOwner]
      : undefined;
    if (filePath === undefined) {
      return defaultToken;
    }
    const token = readTokenFile(filePath).trim();
    if (token.length === 0) {
      throw new Error(
        `The GitHub token file configured for repository owner "${repositoryOwner}" contains no token: ${filePath}`,
      );
    }
    resolvedTokenByRepositoryOwner.set(repositoryOwner, token);
    return token;
  };
};
