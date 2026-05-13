import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
export declare class RevertOrphanedPreparationUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>;
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'createComment'>;
    readonly localCommandRunner: LocalCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'createComment'>, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        preparationStatus: string;
        awaitingWorkspaceStatus: string;
        allowIssueCacheMinutes: number;
        preparationProcessCheckCommand: string;
        awLogDirectoryPath?: string;
        awLogStaleThresholdMinutes?: number;
    }) => Promise<void>;
    private isOrphanedIssue;
    private isAwLogStale;
}
//# sourceMappingURL=RevertOrphanedPreparationUseCase.d.ts.map