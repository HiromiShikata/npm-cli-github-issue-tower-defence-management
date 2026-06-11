import { TriageRepository } from './adapter-interfaces/TriageRepository';
import { IssueCloseReason, TriageData } from '../entities/TriageIssue';
export type SetStoryRequest = {
    projectId: string;
    storyFieldId: string;
    itemId: string;
    storyOptionId: string;
};
export type CloseIssueRequest = {
    owner: string;
    repo: string;
    issueNumber: number;
    reason: IssueCloseReason;
};
export type ActionResult = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export interface TriageViewerUseCaseInterface {
    getTriageData: (projectUrl: string) => Promise<TriageData>;
    setStory: (request: SetStoryRequest) => Promise<ActionResult>;
    closeIssue: (request: CloseIssueRequest) => Promise<ActionResult>;
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
}
export declare class TriageViewerServerStartUseCase implements TriageViewerUseCaseInterface {
    private readonly triageRepository;
    constructor(triageRepository: TriageRepository);
    getTriageData: (projectUrl: string) => Promise<TriageData>;
    setStory: (request: SetStoryRequest) => Promise<ActionResult>;
    closeIssue: (request: CloseIssueRequest) => Promise<ActionResult>;
    fetchImageProxy: (targetUrl: string) => Promise<{
        content: Buffer;
        contentType: string;
    }>;
}
//# sourceMappingURL=TriageViewerServerStartUseCase.d.ts.map