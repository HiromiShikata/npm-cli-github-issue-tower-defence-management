import { BaseGitHubRepository } from './BaseGitHubRepository';
import { PrReviewRepository } from '../../domain/usecases/adapter-interfaces/PrReviewViewerRepository';
import { IssueTitleInfo } from '../../domain/entities/PrReviewViewerItem';
type ReviewComment = {
    path: string;
    position: number;
    body: string;
};
export declare class GitHubPrReviewRepository extends BaseGitHubRepository implements PrReviewRepository {
    private extractGitHubErrorMessage;
    approve: (owner: string, repo: string, prNumber: number, body?: string, comments?: ReviewComment[]) => Promise<void>;
    requestChanges: (owner: string, repo: string, prNumber: number, body?: string, comments?: ReviewComment[]) => Promise<void>;
    comment: (owner: string, repo: string, prNumber: number, body?: string, comments?: ReviewComment[]) => Promise<void>;
    createComment: (owner: string, repo: string, issueNumber: number, body: string) => Promise<void>;
    closePullRequest: (owner: string, repo: string, prNumber: number) => Promise<void>;
    addLabel: (owner: string, repo: string, issueNumber: number, label: string) => Promise<void>;
    updateProjectItemStatus: (projectId: string, fieldId: string, itemId: string, statusOptionId: string) => Promise<void>;
    getFileContent: (owner: string, repo: string, filePath: string, ref: string, prHeadSha: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
    getIssueOrPrTitle: (owner: string, repo: string, number: number) => Promise<IssueTitleInfo>;
}
export {};
//# sourceMappingURL=GitHubPrReviewRepository.d.ts.map