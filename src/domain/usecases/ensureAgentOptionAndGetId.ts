import { FieldOption, Project } from '../entities/Project';
import { normalizeProjectFieldName } from '../entities/ProjectFieldName';
import { AGENT_FIELD_NAME } from '../entities/RequiredProjectField';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';

export const ensureAgentOptionAndGetId = async (
  projectRepository: Pick<
    ProjectRepository,
    'createField' | 'getByUrl' | 'updateAgentList'
  >,
  project: Project,
  agentName: string,
): Promise<string | null> => {
  const normalizedTarget = normalizeProjectFieldName(agentName);
  if (!project.agent) {
    await projectRepository.createField(project, {
      name: AGENT_FIELD_NAME,
      dataType: 'SINGLE_SELECT',
      options: [{ name: agentName, color: 'GRAY' as const, description: '' }],
    });
    const refreshed = await projectRepository.getByUrl(project.url);
    const created = refreshed.agent?.options.find(
      (option) => normalizeProjectFieldName(option.name) === normalizedTarget,
    );
    return created?.id ?? null;
  }
  const existing = project.agent.options.find(
    (option) => normalizeProjectFieldName(option.name) === normalizedTarget,
  );
  if (existing) {
    return existing.id;
  }
  const mergedOptions: (Omit<FieldOption, 'id'> & {
    id: FieldOption['id'] | null;
  })[] = [
    ...project.agent.options.map((option) => ({ ...option })),
    { id: null, name: agentName, color: 'GRAY' as const, description: '' },
  ];
  const updatedOptions = await projectRepository.updateAgentList(
    project,
    mergedOptions,
  );
  const created = updatedOptions.find(
    (option) => normalizeProjectFieldName(option.name) === normalizedTarget,
  );
  return created?.id ?? null;
};
