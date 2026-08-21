import { FieldOption, Project } from '../entities/Project';
import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import {
  AGENT_FIELD_NAME,
  REQUIRED_PROJECT_FIELDS,
  STORY_FIELD_NAME,
} from '../entities/RequiredProjectField';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

type OptionToSubmit = Omit<FieldOption, 'id'> & {
  id: FieldOption['id'] | null;
};

export class ProjectRequiredFieldCreateUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      | 'getByUrl'
      | 'listFieldNames'
      | 'createField'
      | 'updateStoryList'
      | 'updateAgentList'
    >,
  ) {}

  run = async (params: {
    projectUrl: string;
    agents?: string[] | null;
  }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    await this.createMissingFields(project);
    const updatedProject = await this.projectRepository.getByUrl(
      params.projectUrl,
    );
    await this.reconcileStoryOptions(updatedProject);
    await this.reconcileAgentOptions(updatedProject, params.agents ?? null);
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
    const mergedOptions: OptionToSubmit[] = project.story.stories.map((o) => ({
      ...o,
    }));
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

  reconcileAgentOptions = async (
    project: Project,
    agentNames: string[] | null,
  ): Promise<void> => {
    if (!project.agent || !agentNames || agentNames.length === 0) {
      return;
    }
    const existingOptions = project.agent.options;
    const existingNames = new Set(
      existingOptions.map((o) => normalizeProjectFieldName(o.name)),
    );
    const toAdd = agentNames.filter(
      (name) => !existingNames.has(normalizeProjectFieldName(name)),
    );
    if (toAdd.length === 0) {
      return;
    }
    const mergedOptions: OptionToSubmit[] = [
      ...existingOptions.map((o) => ({ ...o })),
      ...toAdd.map((name) => ({
        id: null,
        name,
        color: 'GRAY' as const,
        description: '',
      })),
    ];
    await this.projectRepository.updateAgentList(project, mergedOptions);
  };

  private optionNameSatisfies = (
    currentName: string,
    requiredName: string,
  ): boolean =>
    normalizeProjectFieldName(currentName).startsWith(
      normalizeProjectFieldName(requiredName),
    );

  static readonly AGENT_FIELD_NAME = AGENT_FIELD_NAME;
}
