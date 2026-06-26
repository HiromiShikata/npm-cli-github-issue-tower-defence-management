import { Issue } from '../../entities/Issue';
import { GenerateDashboardRowUseCase } from './GenerateDashboardRowUseCase';

const ASSIGNEE = 'HiromiShikata';

let issueCounter = 0;
const makeIssue = (overrides: Partial<Issue>): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'demo/repo',
    number: issueCounter,
    title: `Issue ${issueCounter}`,
    state: 'OPEN',
    status: null,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: `https://github.com/demo/repo/issues/${issueCounter}`,
    assignees: [ASSIGNEE],
    labels: [],
    org: 'demo',
    repo: 'repo',
    body: '',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date('2026-06-13T08:18:45.000Z'),
    author: 'someone',
    closingIssueReferenceUrls: [],
    ...overrides,
  };
};

describe('GenerateDashboardRowUseCase', () => {
  const usecase = new GenerateDashboardRowUseCase();

  beforeEach(() => {
    issueCounter = 0;
  });

  it('returns all-zero counts for an empty issue list', () => {
    expect(usecase.run({ issues: [], assigneeLogin: ASSIGNEE })).toEqual({
      unread: 0,
      todo: 0,
      qc: 0,
      fail: 0,
      pr: 0,
      ws: 0,
      dep: 0,
      blocker: 0,
    });
  });

  it('counts actionable Unread, Todo, Awaiting Quality Check and Awaiting Workspace issues', () => {
    const issues = [
      makeIssue({ status: 'Unread' }),
      makeIssue({ status: 'Todo by human' }),
      makeIssue({ status: 'Awaiting Quality Check' }),
      makeIssue({ status: 'Awaiting Workspace' }),
    ];

    expect(usecase.run({ issues, assigneeLogin: ASSIGNEE })).toEqual({
      unread: 1,
      todo: 1,
      qc: 1,
      fail: 0,
      pr: 0,
      ws: 1,
      dep: 0,
      blocker: 0,
    });
  });

  it('excludes non-actionable issues from actionable status columns', () => {
    const issues = [
      makeIssue({ status: 'Unread', nextActionDate: new Date() }),
      makeIssue({ status: 'Unread', nextActionHour: 9 }),
      makeIssue({
        status: 'Awaiting Quality Check',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
      makeIssue({ status: 'Todo by human', assignees: ['someone-else'] }),
      makeIssue({ status: 'Awaiting Workspace', isClosed: true }),
    ];

    expect(usecase.run({ issues, assigneeLogin: ASSIGNEE })).toEqual({
      unread: 0,
      todo: 0,
      qc: 0,
      fail: 0,
      pr: 0,
      ws: 0,
      dep: 0,
      blocker: 0,
    });
  });

  it('counts Preparation and Failed Preparation by whole status without the actionable predicate', () => {
    const issues = [
      makeIssue({ status: 'Preparation', nextActionHour: 9 }),
      makeIssue({
        status: 'Failed Preparation',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
      makeIssue({ status: 'Preparation', isClosed: true }),
      makeIssue({ status: 'Failed Preparation', assignees: ['someone-else'] }),
    ];

    expect(usecase.run({ issues, assigneeLogin: ASSIGNEE })).toEqual({
      unread: 0,
      todo: 0,
      qc: 0,
      fail: 1,
      pr: 1,
      ws: 0,
      dep: 0,
      blocker: 0,
    });
  });

  it('counts dep as Awaiting Workspace issues blocked by a dependency, and never as ws', () => {
    const issues = [
      makeIssue({ status: 'Awaiting Workspace' }),
      makeIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
    ];

    expect(usecase.run({ issues, assigneeLogin: ASSIGNEE })).toMatchObject({
      ws: 1,
      dep: 1,
    });
  });

  it('counts blocker by case-insensitive workflow blocker story membership for non-closed mine issues', () => {
    const issues = [
      makeIssue({ status: 'Unread', story: 'Workflow Blocker / urgent' }),
      makeIssue({ status: 'Awaiting Workspace', story: 'workflow blocker' }),
      makeIssue({ status: 'Unread', story: 'regular / maintenance' }),
      makeIssue({
        status: 'Unread',
        story: 'workflow blocker',
        isClosed: true,
      }),
      makeIssue({
        status: 'Unread',
        story: 'workflow blocker',
        assignees: ['someone-else'],
      }),
    ];

    expect(usecase.run({ issues, assigneeLogin: ASSIGNEE }).blocker).toBe(2);
  });
});
