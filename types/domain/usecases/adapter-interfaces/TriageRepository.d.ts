import { IssueCloseReason, TriageData } from '../../entities/TriageIssue';
export interface TriageRepository {
    getTriageData: (projectUrl: string) => Promise<TriageData>;
    setStory: (projectId: string, storyFieldId: string, itemId: string, storyOptionId: string) => Promise<void>;
    closeIssue: (owner: string, repo: string, issueNumber: number, reason: IssueCloseReason) => Promise<void>;
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
}
//# sourceMappingURL=TriageRepository.d.ts.map