import { BaseGitHubRepository } from './BaseGitHubRepository';
import { TriageRepository } from '../../domain/usecases/adapter-interfaces/TriageRepository';
import { IssueCloseReason, TriageData } from '../../domain/entities/TriageIssue';
export declare class GitHubTriageRepository extends BaseGitHubRepository implements TriageRepository {
    private extractGitHubErrorMessage;
    getTriageData: (projectUrl: string) => Promise<TriageData>;
    private extractProjectFromUrl;
    private fetchProjectWithNoStoryItems;
    setStory: (projectId: string, storyFieldId: string, itemId: string, storyOptionId: string) => Promise<void>;
    closeIssue: (owner: string, repo: string, issueNumber: number, reason: IssueCloseReason) => Promise<void>;
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
}
//# sourceMappingURL=GitHubTriageRepository.d.ts.map