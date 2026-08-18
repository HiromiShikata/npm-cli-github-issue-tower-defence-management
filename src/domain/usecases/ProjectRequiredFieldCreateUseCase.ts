import { FieldOption, Project } from '../entities/Project';
import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import {
  REQUIRED_PROJECT_FIELDS,
  STORY_FIELD_NAME,
} from '../entities/RequiredProjectField';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export class ProjectRequiredFieldCreateUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'listFieldNames' | 'createField' | 'updateStoryList'
    >,
  ) {}

  run = async (params: { projectUrl: string }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    await this.createMissingFields(project);
    await this.reconcileStoryOptions(project);
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

  private reconcileStoryOptions = async (project: Project): Promise<void> => {
    if (!project.story) {
      return;
    }
    const storyFieldDefinition = REQUIRED_PROJECT_FIELDS.find(
      (f) =>
        normalizeProjectFieldName(f.name) ===
        normalizeProjectFieldName(STORY_FIELD_NAME),
    );
    if (!storyFieldDefinition) {
      return;
    }
    const requiredOptions = storyFieldDefinition.options;
    const currentOptions = project.story.stories;
    const currentByName = new Map(
      currentOptions.map((o) => [normalizeProjectFieldName(o.name), o]),
    );
    const missingRequired = requiredOptions.filter(
      (r) => !currentByName.has(normalizeProjectFieldName(r.name)),
    );
    if (missingRequired.length === 0) {
      return;
    }
    const requiredByName = new Set(
      requiredOptions.map((r) => normalizeProjectFieldName(r.name)),
    );
    const extraCurrentOptions = currentOptions.filter(
      (o) => !requiredByName.has(normalizeProjectFieldName(o.name)),
    );
    const mergedOptions: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[] = [
      ...requiredOptions.map((r) => {
        const existing = currentByName.get(normalizeProjectFieldName(r.name));
        return existing ? { ...r, id: existing.id } : { ...r, id: null };
      }),
      ...extraCurrentOptions.map((o) => ({ ...o })),
    ];
    await this.projectRepository.updateStoryList(project, mergedOptions);
  };
}
