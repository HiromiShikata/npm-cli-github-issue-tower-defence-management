import { Project } from '../../entities/Project';

export interface StatusDefaultRepository {
  setStatusFieldDefault(project: Project, optionId: string): Promise<void>;
}
