import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
type QualityCheckViewerItem = {
    issue: {
        number: number;
        title: string;
        author: string;
        url: string;
        story: string | null;
        projectItemId: string;
    };
    pr: {
        number: number | null;
        repo: string;
        title: string | null;
        additions: number | null;
        deletions: number | null;
        changedFiles: number | null;
        url: string;
    };
    changedDirectories: string[];
};
export type QualityCheckViewerOutput = {
    stories: {
        name: string;
        color: string;
        order: number;
    }[];
    items: QualityCheckViewerItem[];
};
export declare class RevertNotReadyAwaitingQualityCheckUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly issueRejectionEvaluator;
    private readonly changeTargetPullRequestApprover;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'approvePullRequest' | 'requestChangesWithInlineComment'>, issueCommentRepository: Pick<IssueCommentRepository, 'createComment'>);
    run: (params: {
        projectUrl: string;
        allowIssueCacheMinutes: number;
        labelsAsLlmAgentName?: string[] | null;
        awaitingQualityCheckViewerOutputPath?: string | null;
        donePrUrls?: Set<string> | null;
    }) => Promise<QualityCheckViewerOutput | null>;
}
export {};
//# sourceMappingURL=RevertNotReadyAwaitingQualityCheckUseCase.d.ts.map