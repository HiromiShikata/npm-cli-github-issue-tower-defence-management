import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class SetupTowerDefenceProjectUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>);
    private static readonly LEGACY_STATUS_NAMES;
    private static readonly MIGRATED_FROM_NAMES;
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private static hasRequiredStatusesInCanonicalOrder;
}
//# sourceMappingURL=SetupTowerDefenceProjectUseCase.d.ts.map