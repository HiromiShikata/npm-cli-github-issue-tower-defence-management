import { Project } from '../entities/Project';
import {
  normalizeProjectFieldName,
  REQUIRED_PROJECT_FIELDS,
} from '../entities/RequiredProjectField';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export class ProjectRequiredFieldCreateUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'listFieldNames' | 'createField'
    >,
  ) {}

  run = async (params: { projectUrl: string }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    await this.createMissingFields(project);
  };

  private createMissingFields = async (project: Project): Promise<void> => {
    const existingFieldNames = (
      await this.projectRepository.listFieldNames(project)
    ).map(normalizeProjectFieldName);
    for (const required of REQUIRED_PROJECT_FIELDS) {
      if (
        existingFieldNames.includes(normalizeProjectFieldName(required.name))
      ) {
        continue;
      }
      await this.projectRepository.createField(project, required);
    }
  };
}
