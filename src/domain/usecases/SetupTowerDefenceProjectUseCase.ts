import { FieldOption } from '../entities/Project';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import {
  IN_TMUX_STATUS_NAME,
  LEGACY_IN_TMUX_STATUS_NAME,
  LEGACY_TODO_STATUS_NAME,
  PC_TODO_STATUS_NAME,
  REQUIRED_WORKFLOW_STATUSES,
  TODO_STATUS_NAME,
  WorkflowStatusDefinition,
} from '../entities/WorkflowStatus';

export class SetupTowerDefenceProjectUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'updateStatusList'
    >,
  ) {}

  private static readonly LEGACY_STATUS_NAMES: Readonly<
    Record<string, string>
  > = {
    [TODO_STATUS_NAME]: LEGACY_TODO_STATUS_NAME,
    [IN_TMUX_STATUS_NAME]: LEGACY_IN_TMUX_STATUS_NAME,
  };

  private static readonly MIGRATED_FROM_NAMES: ReadonlySet<string> = new Set([
    LEGACY_TODO_STATUS_NAME,
    LEGACY_IN_TMUX_STATUS_NAME,
    PC_TODO_STATUS_NAME,
  ]);

  run = async (params: { projectUrl: string }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);
    const existing = project.status.statuses;

    const hasMigratedFromName = existing.some((s) =>
      SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(s.name),
    );
    if (
      !hasMigratedFromName &&
      SetupTowerDefenceProjectUseCase.hasRequiredStatusesInCanonicalOrder(
        existing,
      )
    ) {
      return;
    }

    const requiredNames = new Set(
      REQUIRED_WORKFLOW_STATUSES.map((s) => s.name),
    );
    const others = existing.filter(
      (status) =>
        !requiredNames.has(status.name) &&
        !SetupTowerDefenceProjectUseCase.MIGRATED_FROM_NAMES.has(status.name),
    );

    const newStatusList: (Omit<FieldOption, 'id'> & {
      id: FieldOption['id'] | null;
    })[] = [
      ...REQUIRED_WORKFLOW_STATUSES.map((required) => {
        const legacyName =
          SetupTowerDefenceProjectUseCase.LEGACY_STATUS_NAMES[required.name];
        const found =
          existing.find((status) => status.name === required.name) ??
          (legacyName !== undefined
            ? existing.find((status) => status.name === legacyName)
            : undefined);
        return {
          id: found ? found.id : null,
          name: required.name,
          color: required.color,
          description: '',
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
        return (
          actual.name === required.name &&
          actual.color === required.color &&
          actual.description === ''
        );
      },
    );
  };
}
