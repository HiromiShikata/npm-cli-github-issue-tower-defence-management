import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
export declare const adoptIssueAgentDesignationLabel: (issue: Issue, project: Project, configuredAgentNames: string[], projectRepository: Pick<ProjectRepository, "getByUrl" | "createField" | "updateAgentList">, issueRepository: Pick<IssueRepository, "setIssueAgentField" | "removeLabel">) => Promise<void>;
export declare class AgentDesignationLabelAdoptUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>, issueRepository: Pick<IssueRepository, 'setIssueAgentField' | 'removeLabel'>);
    run: (params: {
        project: Project;
        issues: Issue[];
        agents: string[] | null;
    }) => Promise<void>;
}
//# sourceMappingURL=AgentDesignationLabelAdoptUseCase.d.ts.map