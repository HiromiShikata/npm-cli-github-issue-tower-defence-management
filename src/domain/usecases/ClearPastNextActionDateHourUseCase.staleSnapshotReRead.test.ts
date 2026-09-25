import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('ClearPastNextActionDateHourUseCase - stale snapshot re-read', () => {
  jest.setTimeout(60 * 1000);

  const nextActionHourField = {
    name: 'Next Action Hour',
    fieldId: 'hourFieldId',
    options: [],
  };

  const basicProject: Project = {
    id: 'project-1',
    url: 'https://github.com/orgs/org/projects/1',
    databaseId: 1,
    name: 'Test project',
    status: { name: 'Status', fieldId: 'statusFieldId', statuses: [] },
    nextActionDate: null,
    nextActionHour: nextActionHourField,
    story: null,
    remainingEstimationMinutes: null,
    dependedIssueUrlSeparatedByComma: null,
    completionDate50PercentConfidence: null,
    agent: null,
  };

  const buildIssue = (overrides: Partial<Issue>): Issue => ({
    nameWithOwner: 'org/repo',
    number: 101,
    title: 'Sample task issue',
    state: 'OPEN',
    status: null,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: 'https://github.com/org/repo/issues/101',
    assignees: [],
    labels: [],
    org: 'org',
    repo: 'repo',
    body: '',
    itemId: 'item-101',
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    author: 'some-author',
    closingIssueReferenceUrls: [],
    agent: null,
    stateReason: null,
    ...overrides,
  });

  const targetDates = [
    new Date('2026-04-02T10:05:00Z'),
    new Date('2026-04-02T10:15:00Z'),
  ];

  it('pins current behavior: clears nextActionHour for a snapshot issue whose hour is in the past (unfixed code, uses only clearProjectField)', async () => {
    const snapshotIssue = buildIssue({
      nextActionHour: 9,
      nextActionDate: null,
    });
    const clearProjectField = jest.fn<
      Promise<void>,
      [Project, string, Issue]
    >();
    const get = jest
      .fn<Promise<Issue | null>, [string, Project]>()
      .mockResolvedValue(snapshotIssue);
    const issueRepository: Pick<IssueRepository, 'clearProjectField' | 'get'> =
      {
        clearProjectField,
        get,
      };
    const useCase = new ClearPastNextActionDateHourUseCase(issueRepository);

    await useCase.run({
      targetDates,
      project: basicProject,
      issues: [snapshotIssue],
      cacheUsed: false,
    });

    expect(clearProjectField).toHaveBeenCalledWith(
      basicProject,
      'hourFieldId',
      snapshotIssue,
    );
  });

  it('BUG: must not clear when the current live nextActionHour has since moved to a new future value (fails against unfixed code)', async () => {
    const snapshotIssue = buildIssue({
      nextActionHour: 9,
      nextActionDate: null,
    });
    const currentLiveIssue: Issue = { ...snapshotIssue, nextActionHour: 20 };
    const clearProjectField = jest.fn<
      Promise<void>,
      [Project, string, Issue]
    >();
    const get = jest.fn<Promise<Issue | null>, [string, Project]>(
      async (issueUrl) =>
        issueUrl === snapshotIssue.url ? currentLiveIssue : null,
    );
    const issueRepository: Pick<IssueRepository, 'clearProjectField' | 'get'> =
      {
        clearProjectField,
        get,
      };
    const useCase = new ClearPastNextActionDateHourUseCase(issueRepository);

    await useCase.run({
      targetDates,
      project: basicProject,
      issues: [snapshotIssue],
      cacheUsed: false,
    });

    expect(clearProjectField).not.toHaveBeenCalled();
  });

  it('clears when the current live nextActionHour still matches the stale snapshot and is still in the past', async () => {
    const snapshotIssue = buildIssue({
      nextActionHour: 9,
      nextActionDate: null,
    });
    const currentLiveIssue: Issue = { ...snapshotIssue };
    const clearProjectField = jest.fn<
      Promise<void>,
      [Project, string, Issue]
    >();
    const get = jest.fn<Promise<Issue | null>, [string, Project]>(
      async (issueUrl) =>
        issueUrl === snapshotIssue.url ? currentLiveIssue : null,
    );
    const issueRepository: Pick<IssueRepository, 'clearProjectField' | 'get'> =
      {
        clearProjectField,
        get,
      };
    const useCase = new ClearPastNextActionDateHourUseCase(issueRepository);

    await useCase.run({
      targetDates,
      project: basicProject,
      issues: [snapshotIssue],
      cacheUsed: false,
    });

    expect(clearProjectField).toHaveBeenCalledWith(
      basicProject,
      'hourFieldId',
      snapshotIssue,
    );
  });

  it('fails safe and does not clear when the live re-read rejects', async () => {
    const snapshotIssue = buildIssue({
      nextActionHour: 9,
      nextActionDate: null,
    });
    const clearProjectField = jest.fn<
      Promise<void>,
      [Project, string, Issue]
    >();
    const get = jest
      .fn<Promise<Issue | null>, [string, Project]>()
      .mockRejectedValue(new Error('network error'));
    const issueRepository: Pick<IssueRepository, 'clearProjectField' | 'get'> =
      {
        clearProjectField,
        get,
      };
    const useCase = new ClearPastNextActionDateHourUseCase(issueRepository);

    await useCase.run({
      targetDates,
      project: basicProject,
      issues: [snapshotIssue],
      cacheUsed: false,
    });

    expect(clearProjectField).not.toHaveBeenCalled();
  });
});
