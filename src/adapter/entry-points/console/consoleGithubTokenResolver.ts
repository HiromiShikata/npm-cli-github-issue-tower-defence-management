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
    if (githubTokenFilePathByRepositoryOwner === null) {
      return defaultToken;
    }
    const filePath = githubTokenFilePathByRepositoryOwner[repositoryOwner];
    if (filePath === undefined) {
      throw new Error(
        `No GitHub token file is configured for repository owner "${repositoryOwner}". Add an entry for this owner under consoleGithubTokenFilesByRepositoryOwner in the config file.`,
      );
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
