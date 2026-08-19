import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class ProjectRequiredFieldCreateUseCase {
    private readonly projectRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'listFieldNames' | 'createField' | 'updateStoryList'>);
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private createMissingFields;
    private reconcileStoryOptions;
    private optionNameSatisfies;
}
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.d.ts.map