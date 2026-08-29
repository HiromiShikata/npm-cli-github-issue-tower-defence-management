import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { StatusDefaultRepository } from './adapter-interfaces/StatusDefaultRepository';
export declare class SetupTowerDefenceProjectUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly statusDefaultRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>, statusDefaultRepository: Pick<StatusDefaultRepository, 'setStatusFieldDefault'>);
    private static readonly LEGACY_STATUS_NAMES;
    private static readonly UNREAD_MIGRATED_STATUS_NAME;
    private static readonly MIGRATED_FROM_NAMES;
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private static hasRequiredStatusesInCanonicalOrder;
}
//# sourceMappingURL=SetupTowerDefenceProjectUseCase.d.ts.map