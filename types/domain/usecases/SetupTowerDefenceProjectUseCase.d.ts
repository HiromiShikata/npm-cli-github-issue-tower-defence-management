import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class SetupTowerDefenceProjectUseCase {
    private readonly projectRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>);
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private static hasRequiredStatusesInCanonicalOrder;
}
//# sourceMappingURL=SetupTowerDefenceProjectUseCase.d.ts.map