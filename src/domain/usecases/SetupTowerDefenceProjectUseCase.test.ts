import { mock } from 'jest-mock-extended';
import { SetupTowerDefenceProjectUseCase } from './SetupTowerDefenceProjectUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { FieldOption, Project } from '../entities/Project';
import { Issue } from '../entities/Issue';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DEFAULT_STATUS_NAME,
  DONE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
  LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
  LEGACY_IN_TMUX_STATUS_NAME,
  LEGACY_TODO_STATUS_NAME,
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

const buildIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'test-org/test-repo',
  number: 1,
  title: 'Test issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/test-org/test-repo/issues/1',
  assignees: [],
  labels: [],
  org: 'test-org',
  repo: 'test-repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2024-01-01'),
  author: 'user',
  ...overrides,
});

describe('SetupTowerDefenceProjectUseCase', () => {
  it('should define exactly the 9 required statuses in the documented order with the documented colors and no descriptions', () => {
    expect(REQUIRED_WORKFLOW_STATUSES).toEqual([
      { name: DEFAULT_STATUS_NAME, color: 'ORANGE' },
      { name: AWAITING_WORKSPACE_STATUS_NAME, color: 'BLUE' },
      { name: PREPARATION_STATUS_NAME, color: 'YELLOW' },
      { name: FAILED_PREPARATION_STATUS_NAME, color: 'RED' },
      { name: AWAITING_QUALITY_CHECK_STATUS_NAME, color: 'GREEN' },
      { name: TODO_STATUS_NAME, color: 'PINK' },
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
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const project = buildProject(buildCanonicalStatuses());
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).not.toHaveBeenCalled();
  });

  it('should skip update when project already has required statuses plus extras after them', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
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
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).not.toHaveBeenCalled();
  });

  it('should rewrite required statuses with empty descriptions when an existing status carries a description', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses = buildCanonicalStatuses();
    statuses[0] = { ...statuses[0], description: 'stale description' };
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
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
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
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
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
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
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
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
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(payload.map((status) => status.name)).toEqual([
      DEFAULT_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      FAILED_PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      TODO_STATUS_NAME,
      IN_TMUX_STATUS_NAME,
      DONE_STATUS_NAME,
      ICEBOX_STATUS_NAME,
    ]);
  });

  it('should fix color when an existing required status has wrong color', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses = buildCanonicalStatuses();
    statuses[1] = { ...statuses[1], color: 'RED' };
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(payload[1].color).toBe(REQUIRED_WORKFLOW_STATUSES[1].color);
  });

  it('should rename legacy "Todo" to "Todo by human" by reusing the existing option ID', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = REQUIRED_WORKFLOW_STATUSES.map(
      (required, index) => ({
        id: `id-${index}`,
        name:
          required.name === TODO_STATUS_NAME
            ? LEGACY_TODO_STATUS_NAME
            : required.name,
        color: required.color,
        description: '',
      }),
    );
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    const todoEntry = payload.find((s) => s.name === TODO_STATUS_NAME);
    expect(todoEntry).toBeDefined();
    expect(todoEntry?.id).toBe('id-5');
    expect(payload.some((s) => s.name === LEGACY_TODO_STATUS_NAME)).toBe(false);
  });

  it('should rename legacy "In Tmux" to "In Tmux by human" by reusing the existing option ID', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = REQUIRED_WORKFLOW_STATUSES.map(
      (required, index) => ({
        id: `id-${index}`,
        name:
          required.name === IN_TMUX_STATUS_NAME
            ? LEGACY_IN_TMUX_STATUS_NAME
            : required.name,
        color: required.color,
        description: '',
      }),
    );
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    const inTmuxEntry = payload.find((s) => s.name === IN_TMUX_STATUS_NAME);
    expect(inTmuxEntry).toBeDefined();
    expect(inTmuxEntry?.id).toBe('id-6');
    expect(payload.some((s) => s.name === LEGACY_IN_TMUX_STATUS_NAME)).toBe(
      false,
    );
  });

  it('should remove "PC Todo" from the status list and not include it in others', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = [
      ...buildCanonicalStatuses(),
      {
        id: 'pc-todo-id',
        name: PC_TODO_STATUS_NAME,
        color: 'PINK',
        description: '',
      },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(payload.some((s) => s.name === PC_TODO_STATUS_NAME)).toBe(false);
  });

  it('should migrate a project with legacy statuses: rename Todo and In Tmux by ID, remove PC Todo', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = [
      {
        id: 'id-0',
        name: DEFAULT_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'id-1',
        name: AWAITING_WORKSPACE_STATUS_NAME,
        color: 'BLUE',
        description: '',
      },
      {
        id: 'id-2',
        name: PREPARATION_STATUS_NAME,
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'id-3',
        name: FAILED_PREPARATION_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      {
        id: 'id-4',
        name: AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'GREEN',
        description: '',
      },
      {
        id: 'id-5',
        name: LEGACY_TODO_STATUS_NAME,
        color: 'PINK',
        description: '',
      },
      { id: 'id-6', name: PC_TODO_STATUS_NAME, color: 'PINK', description: '' },
      {
        id: 'id-7',
        name: LEGACY_IN_TMUX_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      { id: 'id-8', name: DONE_STATUS_NAME, color: 'PURPLE', description: '' },
      { id: 'id-9', name: ICEBOX_STATUS_NAME, color: 'GRAY', description: '' },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];

    expect(payload.map((s) => s.name)).toEqual([
      DEFAULT_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      FAILED_PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      TODO_STATUS_NAME,
      IN_TMUX_STATUS_NAME,
      DONE_STATUS_NAME,
      ICEBOX_STATUS_NAME,
    ]);

    expect(payload.find((s) => s.name === TODO_STATUS_NAME)?.id).toBe('id-5');
    expect(payload.find((s) => s.name === IN_TMUX_STATUS_NAME)?.id).toBe(
      'id-7',
    );
    expect(payload.some((s) => s.name === PC_TODO_STATUS_NAME)).toBe(false);
    expect(payload.some((s) => s.name === LEGACY_TODO_STATUS_NAME)).toBe(false);
    expect(payload.some((s) => s.name === LEGACY_IN_TMUX_STATUS_NAME)).toBe(
      false,
    );
  });

  it('should migrate issues from "Awaiting Task Breakdown" to "Todo by human" when that status exists', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const todoStatusId = 'todo-status-id';
    const statuses: FieldOption[] = [
      {
        id: 'id-0',
        name: DEFAULT_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'atb-id',
        name: LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'id-1',
        name: AWAITING_WORKSPACE_STATUS_NAME,
        color: 'BLUE',
        description: '',
      },
      {
        id: 'id-2',
        name: PREPARATION_STATUS_NAME,
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'id-3',
        name: FAILED_PREPARATION_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      {
        id: 'id-4',
        name: AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'GREEN',
        description: '',
      },
      {
        id: todoStatusId,
        name: TODO_STATUS_NAME,
        color: 'PINK',
        description: '',
      },
      {
        id: 'id-6',
        name: IN_TMUX_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      { id: 'id-7', name: DONE_STATUS_NAME, color: 'PURPLE', description: '' },
      { id: 'id-8', name: ICEBOX_STATUS_NAME, color: 'GRAY', description: '' },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);

    const atbIssue1 = buildIssue({
      number: 10,
      url: 'https://github.com/test-org/test-repo/issues/10',
      itemId: 'item-10',
      status: LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
    });
    const atbIssue2 = buildIssue({
      number: 11,
      url: 'https://github.com/test-org/test-repo/issues/11',
      itemId: 'item-11',
      status: LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
    });
    const otherIssue = buildIssue({
      number: 12,
      url: 'https://github.com/test-org/test-repo/issues/12',
      itemId: 'item-12',
      status: AWAITING_WORKSPACE_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [atbIssue1, atbIssue2, otherIssue],
      cacheUsed: false,
    });
    mockIssueRepository.updateStatus.mockResolvedValue(undefined);

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockIssueRepository.getAllIssues).toHaveBeenCalledWith(
      project.id,
      0,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      atbIssue1,
      todoStatusId,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      atbIssue2,
      todoStatusId,
    );

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(
      payload.some(
        (s) => s.name === LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
      ),
    ).toBe(false);
    expect(payload.map((s) => s.name)).toEqual([
      DEFAULT_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      FAILED_PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      TODO_STATUS_NAME,
      IN_TMUX_STATUS_NAME,
      DONE_STATUS_NAME,
      ICEBOX_STATUS_NAME,
    ]);
  });

  it('should skip issue migration when "Awaiting Task Breakdown" status does not exist', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const project = buildProject(buildCanonicalStatuses());
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockProjectRepository.updateStatusList).not.toHaveBeenCalled();
  });

  it('should remove "Awaiting Task Breakdown" from the status list after migrating all affected issues', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = [
      ...buildCanonicalStatuses(),
      {
        id: 'atb-id',
        name: LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });
    mockIssueRepository.updateStatus.mockResolvedValue(undefined);

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];
    expect(
      payload.some(
        (s) => s.name === LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
      ),
    ).toBe(false);
  });

  it('should migrate a project with all legacy statuses including Awaiting Task Breakdown', async () => {
    const mockProjectRepository =
      mock<Pick<ProjectRepository, 'getByUrl' | 'updateStatusList'>>();
    const mockIssueRepository =
      mock<Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>>();
    const statuses: FieldOption[] = [
      {
        id: 'id-0',
        name: DEFAULT_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'id-1',
        name: LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
        color: 'ORANGE',
        description: '',
      },
      {
        id: 'id-2',
        name: AWAITING_WORKSPACE_STATUS_NAME,
        color: 'BLUE',
        description: '',
      },
      {
        id: 'id-3',
        name: PREPARATION_STATUS_NAME,
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'id-4',
        name: FAILED_PREPARATION_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      {
        id: 'id-5',
        name: AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'GREEN',
        description: '',
      },
      {
        id: 'id-6',
        name: LEGACY_TODO_STATUS_NAME,
        color: 'PINK',
        description: '',
      },
      { id: 'id-7', name: PC_TODO_STATUS_NAME, color: 'PINK', description: '' },
      {
        id: 'id-8',
        name: LEGACY_IN_TMUX_STATUS_NAME,
        color: 'RED',
        description: '',
      },
      { id: 'id-9', name: DONE_STATUS_NAME, color: 'PURPLE', description: '' },
      { id: 'id-10', name: ICEBOX_STATUS_NAME, color: 'GRAY', description: '' },
    ];
    const project = buildProject(statuses);
    mockProjectRepository.getByUrl.mockResolvedValue(project);
    mockProjectRepository.updateStatusList.mockResolvedValue([]);
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      cacheUsed: false,
    });
    mockIssueRepository.updateStatus.mockResolvedValue(undefined);

    const useCase = new SetupTowerDefenceProjectUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
    await useCase.run({ projectUrl: project.url });

    expect(mockProjectRepository.updateStatusList).toHaveBeenCalledTimes(1);
    const [, payload] = mockProjectRepository.updateStatusList.mock.calls[0];

    expect(payload.map((s) => s.name)).toEqual([
      DEFAULT_STATUS_NAME,
      AWAITING_WORKSPACE_STATUS_NAME,
      PREPARATION_STATUS_NAME,
      FAILED_PREPARATION_STATUS_NAME,
      AWAITING_QUALITY_CHECK_STATUS_NAME,
      TODO_STATUS_NAME,
      IN_TMUX_STATUS_NAME,
      DONE_STATUS_NAME,
      ICEBOX_STATUS_NAME,
    ]);

    expect(payload.find((s) => s.name === TODO_STATUS_NAME)?.id).toBe('id-6');
    expect(payload.find((s) => s.name === IN_TMUX_STATUS_NAME)?.id).toBe(
      'id-8',
    );
    expect(payload.some((s) => s.name === PC_TODO_STATUS_NAME)).toBe(false);
    expect(payload.some((s) => s.name === LEGACY_TODO_STATUS_NAME)).toBe(false);
    expect(payload.some((s) => s.name === LEGACY_IN_TMUX_STATUS_NAME)).toBe(
      false,
    );
    expect(
      payload.some(
        (s) => s.name === LEGACY_AWAITING_TASK_BREAKDOWN_STATUS_NAME,
      ),
    ).toBe(false);
  });
});
