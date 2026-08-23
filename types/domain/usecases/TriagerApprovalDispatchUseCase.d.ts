import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class TriagerApprovalDispatchUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject' | 'createField' | 'getByUrl' | 'updateAgentList'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'updateStory' | 'setIssueAgentField'>, issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>);
    run: (params: {
        projectUrl: string;
        allowedIssueAuthors?: string[] | null;
        cycleIndex?: number;
    }) => Promise<void>;
}
//# sourceMappingURL=TriagerApprovalDispatchUseCase.d.ts.map