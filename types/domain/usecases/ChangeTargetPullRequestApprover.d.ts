import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class ChangeTargetPullRequestApprover {
    private readonly issueRepository;
    constructor(issueRepository: Pick<IssueRepository, 'getPullRequestChangedFilePaths' | 'approvePullRequest'>);
    approveIfConfined: (issueLabels: string[], approvedPrUrl: string | null, pathAliases?: Record<string, string> | null) => Promise<void>;
    private extractChangeTargetPaths;
    private isFilePathConfinedToAllowedPaths;
}
//# sourceMappingURL=ChangeTargetPullRequestApprover.d.ts.map