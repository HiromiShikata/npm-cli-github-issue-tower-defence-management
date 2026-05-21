import { mock } from 'jest-mock-extended';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { FieldOption, Project } from '../entities/Project';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_TASK_BREAKDOWN_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DEFAULT_STATUS_NAME,
  DONE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
  PC_TODO_STATUS_NAME,
  PREPARATION_STATUS_NAME,
  REQUIRED_WORKFLOW_STATUSES,
  TODO_STATUS_NAME,
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
    description: '',
  }));

describe('SetupTowerDefenceProjectUseCase', () => {
  it('should define exactly the 11 required statuses in the documented order with the documented colors and no descriptions', () => {
    expect(REQUIRED_WORKFLOW_STATUSES).toEqual([
      { name: DEFAULT_STATUS_NAME, color: 'ORANGE' },
      { name: AWAITING_TASK_BREAKDOWN_STATUS_NAME, color: 'ORANGE' },
      { name: AWAITING_WORKSPACE_STATUS_NAME, color: 'BLUE' },
      { name: PREPARATION_STATUS_NAME, color: 'YELLOW' },
      { name: FAILED_PREPARATION_STATUS_NAME, color: 'RED' },
      { name: AWAITING_QUALITY_CHECK_STATUS_NAME, color: 'GREEN' },
      { name: TODO_STATUS_NAME, color: 'PINK' },
      { name: PC_TODO_STATUS_NAME, color: 'PINK' },
      { name: IN_TMUX_STATUS_NAME, color: 'RED' },
      { name: DONE_STATUS_NAME, color: 'PURPLE' },
      { name: ICEBOX_STATUS_NAME, color: 'GRAY' },
    ]);
    for (const required of REQUIRED_WORKFLOW_STATUSES) {
      expect(required).not.toHaveProperty('description');
    }
  });

  it('should skip update when project already has required statuses in canonical order with no descriptions', async () => {
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
        name: 'Custom Extra Status',
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

  it('should rewrite required statuses with empty descriptions when an existing status carries a description', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const statuses = buildCanonicalStatuses();
    statuses[0] = { ...statuses[0], description: 'stale description' };
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);

    const useCase = new SetupTowerDefenceProjectUseCase(mockProjectRepository);
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(
      payload
        .slice(0, REQUIRED_WORKFLOW_STATUSES.length)
        .every((status) => status.description === ''),
    ).toBe(true);
  });

  it('should add missing required statuses while preserving existing custom statuses', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const statuses: FieldOption[] = [
      {
        id: 'unread-id',
        name: DEFAULT_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'extra-1',
        name: 'Custom Extra Status',
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
          color: 'ORANGE',
          description: '',
        },
        {
          id: null,
          name: AWAITING_TASK_BREAKDOWN_STATUS_NAME,
          color: 'ORANGE',
          description: '',
        },
        {
          id: null,
          name: AWAITING_WORKSPACE_STATUS_NAME,
          color: 'BLUE',
          description: '',
        },
        {
          id: null,
          name: PREPARATION_STATUS_NAME,
          color: 'YELLOW',
          description: '',
        },
        {
          id: null,
          name: FAILED_PREPARATION_STATUS_NAME,
          color: 'RED',
          description: '',
        },
        {
          id: null,
          name: AWAITING_QUALITY_CHECK_STATUS_NAME,
          color: 'GREEN',
          description: '',
        },
        {
          id: null,
          name: TODO_STATUS_NAME,
          color: 'PINK',
          description: '',
        },
        {
          id: null,
          name: PC_TODO_STATUS_NAME,
          color: 'PINK',
          description: '',
        },
        {
          id: null,
          name: IN_TMUX_STATUS_NAME,
          color: 'RED',
          description: '',
        },
        {
          id: null,
          name: DONE_STATUS_NAME,
          color: 'PURPLE',
          description: '',
        },
        {
          id: null,
          name: ICEBOX_STATUS_NAME,
          color: 'GRAY',
          description: '',
        },
        {
          id: 'extra-1',
          name: 'Custom Extra Status',
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
        description: '',
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
      AWAITING_TASK_BREAKDOWN_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      FAILED_PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      TODO_STATUS_NAME,
      PC_TODO_STATUS_NAME,
      IN_TMUX_STATUS_NAME,
      DONE_STATUS_NAME,
      ICEBOX_STATUS_NAME,
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
    expect(payload[2].color).toBe(REQUIRED_WORKFLOW_STATUSES[2].color);
  });
});
