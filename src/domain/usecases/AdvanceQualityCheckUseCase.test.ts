import { AdvanceQualityCheckUseCase } from './AdvanceQualityCheckUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: AWAITING_QUALITY_CHECK_STATUS_NAME,
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
  ...overrides,
});

const createMergedPr = (
  closingIssueUrl: string,
  overrides: Partial<Issue> = {},
): Issue => ({
  nameWithOwner: 'user/repo',
  number: 100,
  title: 'Merged PR',
  state: 'MERGED',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/pull/100',
  assignees: [],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'pr-item-1',
  isPr: true,
  isInProgress: false,
  isClosed: true,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [closingIssueUrl],
  agent: null,
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
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'awaiting-quality-check-id',
        name: AWAITING_QUALITY_CHECK_STATUS_NAME,
        color: 'GREEN',
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

const FIXED_NOW = new Date('2026-01-15T10:00:00Z');

describe('AdvanceQualityCheckUseCase', () => {
  let useCase: AdvanceQualityCheckUseCase;
  let mockIssueRepository: Mocked<Pick<IssueRepository, 'updateStatus'>>;

  beforeEach(() => {
    mockIssueRepository = {
      updateStatus: jest.fn(),
    };
    useCase = new AdvanceQualityCheckUseCase(mockIssueRepository);
  });

  it('moves an issue in Awaiting Quality Check status to Done when its linked PR is merged', async () => {
    const issue = createMockIssue();
    const mergedPr = createMergedPr(issue.url);
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [issue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue,
      'done-id',
    );
  });

  it('moves multiple issues in Awaiting Quality Check status to Done when each has a merged linked PR', async () => {
    const issue1 = createMockIssue({
      number: 1,
      url: 'https://github.com/user/repo/issues/1',
    });
    const issue2 = createMockIssue({
      number: 2,
      url: 'https://github.com/user/repo/issues/2',
    });
    const mergedPr1 = createMergedPr(issue1.url, {
      number: 101,
      url: 'https://github.com/user/repo/pull/101',
      itemId: 'pr-item-101',
    });
    const mergedPr2 = createMergedPr(issue2.url, {
      number: 102,
      url: 'https://github.com/user/repo/pull/102',
      itemId: 'pr-item-102',
    });
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [issue1, issue2, mergedPr1, mergedPr2],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue1,
      'done-id',
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue2,
      'done-id',
    );
  });

  it('does not move issues that are not in Awaiting Quality Check status', async () => {
    const awaitingWorkspaceIssue = createMockIssue({
      status: 'Awaiting Workspace',
    });
    const mergedPr = createMergedPr(awaitingWorkspaceIssue.url);
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [awaitingWorkspaceIssue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not move closed issues', async () => {
    const closedIssue = createMockIssue({ isClosed: true });
    const mergedPr = createMergedPr(closedIssue.url);
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [closedIssue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('respects a custom awaiting quality check status name', async () => {
    const customStatusName = 'Custom Review Status';
    const issue = createMockIssue({ status: customStatusName });
    const mergedPr = createMergedPr(issue.url);
    const project = createMockProject();
    project.status.statuses.push({
      id: 'custom-review-id',
      name: customStatusName,
      color: 'BLUE',
      description: '',
    });

    await useCase.run({
      project,
      issues: [issue, mergedPr],
      awaitingQualityCheckStatusName: customStatusName,
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue,
      'done-id',
    );
  });

  it('does not call updateStatus when Done status is not found in project', async () => {
    const issue = createMockIssue();
    const mergedPr = createMergedPr(issue.url);
    const project = createMockProject();
    project.status.statuses = project.status.statuses.filter(
      (s) => s.name !== DONE_STATUS_NAME,
    );

    await useCase.run({
      project,
      issues: [issue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('returns the count of advanced issues', async () => {
    const issue1 = createMockIssue({ number: 1 });
    const issue2 = createMockIssue({
      number: 2,
      url: 'https://github.com/user/repo/issues/2',
    });
    const notAdvancedIssue = createMockIssue({
      number: 3,
      url: 'https://github.com/user/repo/issues/3',
      status: 'Awaiting Workspace',
    });
    const mergedPr1 = createMergedPr(issue1.url, {
      number: 101,
      url: 'https://github.com/user/repo/pull/101',
      itemId: 'pr-item-101',
    });
    const mergedPr2 = createMergedPr(issue2.url, {
      number: 102,
      url: 'https://github.com/user/repo/pull/102',
      itemId: 'pr-item-102',
    });
    const project = createMockProject();

    const count = await useCase.run({
      project,
      issues: [issue1, issue2, notAdvancedIssue, mergedPr1, mergedPr2],
      evaluatedAt: FIXED_NOW,
    });

    expect(count).toBe(2);
  });

  it('does not advance an issue when no merged PR is linked to it', async () => {
    const issue = createMockIssue();
    const openPr = createMockIssue({
      number: 100,
      url: 'https://github.com/user/repo/pull/100',
      itemId: 'pr-item-1',
      isPr: true,
      state: 'OPEN',
      status: null,
      isClosed: false,
      closingIssueReferenceUrls: [issue.url],
    });
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [issue, openPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not advance an issue with a pending nextActionDate reactivation trigger', async () => {
    const futureDate = new Date('2099-12-31T00:00:00Z');
    const issue = createMockIssue({ nextActionDate: futureDate });
    const mergedPr = createMergedPr(issue.url);
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [issue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not advance an issue with dependedIssueUrls set', async () => {
    const issue = createMockIssue({
      dependedIssueUrls: [
        'https://github.com/user/repo/issues/999',
      ],
    });
    const mergedPr = createMergedPr(issue.url);
    const project = createMockProject();

    await useCase.run({
      project,
      issues: [issue, mergedPr],
      evaluatedAt: FIXED_NOW,
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('advances the remaining items when one updateStatus call fails', async () => {
    const issue1 = createMockIssue({
      number: 1,
      url: 'https://github.com/user/repo/issues/1',
    });
    const issue2 = createMockIssue({
      number: 2,
      url: 'https://github.com/user/repo/issues/2',
    });
    const mergedPr1 = createMergedPr(issue1.url, {
      number: 101,
      url: 'https://github.com/user/repo/pull/101',
      itemId: 'pr-item-101',
    });
    const mergedPr2 = createMergedPr(issue2.url, {
      number: 102,
      url: 'https://github.com/user/repo/pull/102',
      itemId: 'pr-item-102',
    });
    const project = createMockProject();
    const updateError = new Error('updateStatus failed for issue1');
    mockIssueRepository.updateStatus
      .mockRejectedValueOnce(updateError)
      .mockResolvedValueOnce(undefined);

    await expect(
      useCase.run({
        project,
        issues: [issue1, issue2, mergedPr1, mergedPr2],
        evaluatedAt: FIXED_NOW,
      }),
    ).rejects.toBeInstanceOf(AggregateError);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue2,
      'done-id',
    );
  });
});
