import { mock } from 'jest-mock-extended';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../entities/Project';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DEFAULT_STATUS_NAME,
  DISABLED_STATUS_NAME,
  PREPARATION_STATUS_NAME,
  REQUIRED_WORKFLOW_STATUSES,
} from '../entities/WorkflowStatus';

const buildProject = (statuses: FieldOption[]): Project => ({
  id: 'project-1',
  url: 'https://github.com/orgs/test-org/projects/1',
  databaseId: 1,
  name: 'test-project',
  status: {
    name: 'Status',
    fieldId: 'status-field-1',
    statuses,
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const buildCanonicalStatuses = (): FieldOption[] =>
  REQUIRED_WORKFLOW_STATUSES.map((required, index) => ({
    id: `id-${index}`,
    name: required.name,
    color: required.color,
    description: required.description,
  }));

describe('SetupTowerDefenceProjectUseCase', () => {
  it('should skip update when project already has required statuses in canonical order', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const project = buildProject(buildCanonicalStatuses());
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).not.toHaveBeenCalled();
  });

  it('should skip update when project already has required statuses plus extras after them', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const statuses = [
      ...buildCanonicalStatuses(),
      {
        id: 'extra-1',
        name: 'Done',
        color: 'GREEN' as const,
        description: '',
      },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).not.toHaveBeenCalled();
  });

  it('should add missing required statuses while preserving existing custom statuses', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const statuses: FieldOption[] = [
      {
        id: 'unread-id',
        name: DEFAULT_STATUS_NAME,
        color: 'GRAY',
        description: 'Default fallback status for issues before triage',
      },
      {
        id: 'extra-1',
        name: 'Done',
        color: 'GREEN',
        description: '',
      },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledWith(
      project,
      [
        {
          id: 'unread-id',
          name: DEFAULT_STATUS_NAME,
          color: 'GRAY',
          description: 'Default fallback status for issues before triage',
        },
        {
          id: null,
          name: AWAITING_WORKSPACE_STATUS_NAME,
          color: 'YELLOW',
          description: 'Issue is ready and waiting for an agent workspace',
        },
        {
          id: null,
          name: PREPARATION_STATUS_NAME,
          color: 'ORANGE',
          description: 'Agent is preparing the issue',
        },
        {
          id: null,
          name: AWAITING_QUALITY_CHECK_STATUS_NAME,
          color: 'BLUE',
          description: 'Awaiting human quality check',
        },
        {
          id: null,
          name: DISABLED_STATUS_NAME,
          color: 'GRAY',
          description: 'Disabled and excluded from the active workflow',
        },
        {
          id: 'extra-1',
          name: 'Done',
          color: 'GREEN',
          description: '',
        },
      ],
    );
  });

  it('should reorder existing required statuses into canonical order when out of order', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const reversedStatuses: FieldOption[] = REQUIRED_WORKFLOW_STATUSES.slice()
      .reverse()
      .map((required, index) => ({
        id: `reversed-id-${index}`,
        name: required.name,
        color: required.color,
        description: required.description,
      }));
    const project = buildProject(reversedStatuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(payload.map((status) => status.name)).toEqual([
      DEFAULT_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      DISABLED_STATUS_NAME,
    ]);
  });

  it('should fix color when an existing required status has wrong color', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const statuses = buildCanonicalStatuses();
    statuses[2] = { ...statuses[2], color: 'RED' };
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(payload[2].color).toBe('ORANGE');
  });
});
