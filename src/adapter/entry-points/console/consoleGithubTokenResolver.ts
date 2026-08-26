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
  githubTokenFileDirPath: string | null,
  readTokenFile: GithubTokenFileReader,
): ConsoleGithubTokenResolver => {
  const resolvedTokenByRepositoryOwner = new Map<string, string>();
  return (repositoryOwner: string): string => {
    const alreadyResolved = resolvedTokenByRepositoryOwner.get(repositoryOwner);
    if (alreadyResolved !== undefined) {
      return alreadyResolved;
    }
    if (consoleProjectUrls === null || githubTokenFileDirPath === null) {
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
    const filePath = `${githubTokenFileDirPath}/tdpm-github-token-${matchedPjcode}.txt`;
    let fileContent: string;
    try {
      fileContent = readTokenFile(filePath);
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return defaultToken;
      }
      throw error;
    }
    const token = fileContent.trim();
    if (token.length === 0) {
      throw new Error(
        `The GitHub token file for pjcode "${matchedPjcode}" contains no token: ${filePath}`,
      );
    }
    resolvedTokenByRepositoryOwner.set(repositoryOwner, token);
    return token;
  };
};
