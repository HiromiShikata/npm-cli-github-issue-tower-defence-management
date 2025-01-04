import { Project } from '../../entities/Project';

export interface ProjectRepository {
  findProjectIdByUrl: (projectUrl: string) => Promise<Project['id'] | null>;
  getProject: (projectId: Project['id']) => Promise<Project | null>;
  removeItemFromProject: (projectId: string, itemId: string) => Promise<void>;
}
