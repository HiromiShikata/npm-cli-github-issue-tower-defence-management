import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class SetupTowerDefenceProjectUseCase {
    private readonly projectRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>);
    private static readonly LEGACY_STATUS_NAMES;
    private static readonly MIGRATED_FROM_NAMES;
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private static hasRequiredStatusesInCanonicalOrder;
}
//# sourceMappingURL=SetupTowerDefenceProjectUseCase.d.ts.map