import { FieldOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import {
  REQUIRED_WORKFLOW_STATUSES,
  WorkflowStatusDefinition,
} from '../entities/WorkflowStatus';

export class SetupTowerDefenceProjectUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'updateStatusList'
    >,
  ) {}

  run = async (params: { projectUrl: string }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const existing = project.status.statuses;

    if (
      SetupTowerDefenceProjectUseCase.hasRequiredStatusesInCanonicalOrder(
        existing,
      )
    ) {
      return;
    }

    const requiredNames = new Set(
      REQUIRED_WORKFLOW_STATUSES.map((s) => s.name),
    );
    const others = existing.filter((status) => !requiredNames.has(status.name));

    const newStatusList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[] = [
      ...REQUIRED_WORKFLOW_STATUSES.map((required) => {
        const found = existing.find((status) => status.name === required.name);
        return {
          id: found ? found.id : null,
          name: required.name,
          color: required.color,
          description: required.description,
        };
      }),
      ...others.map((other) => ({
        id: other.id,
        name: other.name,
        color: other.color,
        description: other.description,
      })),
    ];

    await this.projectRepository.updateStatusList(project, newStatusList);
  };

  private static hasRequiredStatusesInCanonicalOrder = (
    existing: FieldOption[],
  ): boolean => {
    if (existing.length < REQUIRED_WORKFLOW_STATUSES.length) {
      return false;
    }
    return REQUIRED_WORKFLOW_STATUSES.every(
      (required: WorkflowStatusDefinition, index: number) => {
        const actual = existing[index];
        return actual.name === required.name && actual.color === required.color;
      },
    );
  };
}
