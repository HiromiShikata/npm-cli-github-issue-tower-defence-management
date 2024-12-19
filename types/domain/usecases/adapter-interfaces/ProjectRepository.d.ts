import { Project } from '../../entities/Project';
export interface ProjectRepository {
    findProjectIdByUrl: (projectUrl: string) => Promise<Project['id'] | null>;
    getProject: (projectId: Project['id']) => Promise<Project | null>;
}
//# sourceMappingURL=ProjectRepository.d.ts.map