import { FieldOption, Project } from '../entities/Project';
import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import {
  REQUIRED_PROJECT_FIELDS,
  STORY_FIELD_NAME,
} from '../entities/RequiredProjectField';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

type StoryOptionToSubmit = Omit<FieldOption, 'id'> & {
  id: FieldOption['id'] | null;
};

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
    const mergedOptions: StoryOptionToSubmit[] = project.story.stories.map(
      (o) => ({ ...o }),
    );
    let addedCount = 0;
    let previousRequiredIndex = -1;
    for (const required of requiredOptions) {
      const existingIndex = mergedOptions.findIndex((o) =>
        this.optionNameSatisfies(o.name, required.name),
      );
      if (existingIndex >= 0) {
        previousRequiredIndex = existingIndex;
        continue;
      }
      const insertIndex = previousRequiredIndex + 1;
      mergedOptions.splice(insertIndex, 0, { ...required, id: null });
      previousRequiredIndex = insertIndex;
      addedCount += 1;
    }
    if (addedCount === 0) {
      return;
    }
    await this.projectRepository.updateStoryList(project, mergedOptions);
  };

  private optionNameSatisfies = (
    currentName: string,
    requiredName: string,
  ): boolean =>
    normalizeProjectFieldName(currentName).startsWith(
      normalizeProjectFieldName(requiredName),
    );
}
