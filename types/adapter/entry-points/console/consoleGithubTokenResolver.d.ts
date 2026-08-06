export type ConsoleGithubTokenResolver = (repositoryOwner: string) => string;
export type GithubTokenFileReader = (filePath: string) => string;
export declare const extractRepositoryOwner: (issueOrPullRequestUrl: string) => string | null;
export declare const createConsoleIssueRepositoryResolver: <IssueRepositoryType>(resolveGithubToken: ConsoleGithubTokenResolver, buildIssueRepositoryForToken: (githubToken: string) => IssueRepositoryType) => ((issueOrPullRequestUrl: string) => IssueRepositoryType);
export declare const createConsoleGithubTokenResolver: (defaultToken: string, githubTokenFilePathByRepositoryOwner: Record<string, string> | null, readTokenFile: GithubTokenFileReader) => ConsoleGithubTokenResolver;
//# sourceMappingURL=consoleGithubTokenResolver.d.ts.map