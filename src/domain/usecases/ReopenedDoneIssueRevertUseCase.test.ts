import { ReopenedDoneIssueRevertUseCase } from './ReopenedDoneIssueRevertUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: DONE_STATUS_NAME,
  story: 'Default Story',
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: 'REOPENED',
  ...overrides,
});

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/orgs/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      {
        id: 'awaiting-workspace-id',
        name: AWAITING_WORKSPACE_STATUS_NAME,
        color: 'BLUE',
        description: '',
      },
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'done-id',
        name: DONE_STATUS_NAME,
        color: 'PURPLE',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

describe('ReopenedDoneIssueRevertUseCase', () => {
  let useCase: ReopenedDoneIssueRevertUseCase;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'updateStatus'>>;

  beforeEach(() => {
    mockIssueRepository = {
      updateStatus: jest.fn(),
    };
    useCase = new ReopenedDoneIssueRevertUseCase(mockIssueRepository);
  });

  it('resets a Done issue with stateReason REOPENED to Awaiting Workspace', async () => {
    const issue = createMockIssue();
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue,
      'awaiting-workspace-id',
    );
  });

  it('does not reset a Done issue with stateReason COMPLETED', async () => {
    const issue = createMockIssue({ stateReason: 'COMPLETED' });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reset a Done issue with stateReason null', async () => {
    const issue = createMockIssue({ stateReason: null });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reset a PR item even when Done and stateReason is REOPENED', async () => {
    const prIssue = createMockIssue({
      isPr: true,
      url: 'https://github.com/user/repo/pull/10',
    });
    const project = createMockProject();

    await useCase.run({ project, issues: [prIssue] });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reset an issue that is not in Done status', async () => {
    const issue = createMockIssue({ status: 'Awaiting Workspace' });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('logs an error and returns 0 when Awaiting Workspace status option is missing', async () => {
    const issue = createMockIssue();
    const project = createMockProject();
    project.status.statuses = project.status.statuses.filter(
      (s) => s.name !== AWAITING_WORKSPACE_STATUS_NAME,
    );
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await useCase.run({ project, issues: [issue] });

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('collects updateStatus failures and re-throws as AggregateError after processing all items', async () => {
    const issue1 = createMockIssue({
      number: 1,
      url: 'https://github.com/user/repo/issues/1',
      itemId: 'item-1',
    });
    const issue2 = createMockIssue({
      number: 2,
      url: 'https://github.com/user/repo/issues/2',
      itemId: 'item-2',
    });
    const project = createMockProject();
    const updateError = new Error('updateStatus failed for issue1');
    mockIssueRepository.updateStatus
      .mockRejectedValueOnce(updateError)
      .mockResolvedValueOnce(undefined);

    await expect(
      useCase.run({ project, issues: [issue1, issue2] }),
    ).rejects.toBeInstanceOf(AggregateError);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue2,
      'awaiting-workspace-id',
    );
  });
});
