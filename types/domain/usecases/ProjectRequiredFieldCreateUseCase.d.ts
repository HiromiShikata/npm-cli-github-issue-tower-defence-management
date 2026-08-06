import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class ProjectRequiredFieldCreateUseCase {
    private readonly projectRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'listFieldNames' | 'createField'>);
    run: (params: {
        projectUrl: string;
    }) => Promise<void>;
    private createMissingFields;
}
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.d.ts.map