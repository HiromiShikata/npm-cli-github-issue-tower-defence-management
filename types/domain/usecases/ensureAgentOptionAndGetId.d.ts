import { Project } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
export declare const ensureAgentOptionAndGetId: (projectRepository: Pick<ProjectRepository, "createField" | "getByUrl" | "updateAgentList">, project: Project, agentName: string) => Promise<string | null>;
//# sourceMappingURL=ensureAgentOptionAndGetId.d.ts.map