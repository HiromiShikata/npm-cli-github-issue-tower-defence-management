import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare class ProjectRequiredFieldCreateUseCase {
    private readonly projectRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'listFieldNames' | 'createField' | 'updateStoryList' | 'updateAgentList'>);
    run: (params: {
        projectUrl: string;
        agents?: string[] | null;
    }) => Promise<void>;
    private createMissingFields;
    private reconcileStoryOptions;
    reconcileAgentOptions: (project: Project, agentNames: string[] | null) => Promise<void>;
    private optionNameSatisfies;
    static readonly AGENT_FIELD_NAME = "Agent";
}
//# sourceMappingURL=ProjectRequiredFieldCreateUseCase.d.ts.map