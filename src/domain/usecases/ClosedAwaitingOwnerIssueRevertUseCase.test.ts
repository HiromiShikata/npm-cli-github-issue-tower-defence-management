import { ClosedAwaitingOwnerIssueRevertUseCase } from './ClosedAwaitingOwnerIssueRevertUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { Comment } from '../entities/Comment';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const OWNER_LOGIN = 'HiromiShikata';

const AGENT_REPORT_BODY =
  'From: :robot: developer (example-model)\n\nThe implementation is waiting for the owner decision.\n\n```json\n{"needOwnerConfirmationOrApproval": true}\n```';

let createdIssuesByUrl = new Map<string, Issue>();

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => {
  const issue = buildMockIssue(overrides);
  createdIssuesByUrl.set(issue.url, issue);
  return issue;
};

const buildMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'CLOSED',
  status: AWAITING_OWNER_STATUS_NAME,
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
  isClosed: true,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  author: OWNER_LOGIN,
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
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
        id: 'awaiting-owner-id',
        name: AWAITING_OWNER_STATUS_NAME,
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

const createComment = (params: {
  author?: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
}): Comment => ({
  author: params.author ?? OWNER_LOGIN,
  content: params.content,
  createdAt: params.createdAt,
  updatedAt: params.updatedAt ?? params.createdAt,
});

describe('ClosedAwaitingOwnerIssueRevertUseCase', () => {
  let useCase: ClosedAwaitingOwnerIssueRevertUseCase;
  let mockIssueRepository: Mocked<
    Pick<
      IssueRepository,
      | 'reopenIssueByUrl'
      | 'updateStatus'
      | 'get'
      | 'removeIssueFromProjectCache'
      | 'getLatestReopenedEventAt'
    >
  >;
  let mockIssueCommentRepository: Mocked<
    Pick<IssueCommentRepository, 'getCommentsFromIssue'>
  >;

  beforeEach(() => {
    createdIssuesByUrl = new Map<string, Issue>();
    mockIssueRepository = {
      reopenIssueByUrl: jest.fn().mockResolvedValue(undefined),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      get: jest
        .fn()
        .mockImplementation((issueUrl: string) =>
          Promise.resolve(
            createdIssuesByUrl.get(issueUrl) ??
              buildMockIssue({ url: issueUrl }),
          ),
        ),
      removeIssueFromProjectCache: jest.fn().mockResolvedValue(undefined),
      getLatestReopenedEventAt: jest.fn().mockResolvedValue(null),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
    };
    useCase = new ClosedAwaitingOwnerIssueRevertUseCase(
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('reopens and reverts a closed Awaiting Owner issue to Awaiting Workspace, returning the reverted count', async () => {
    const issue = createMockIssue({ isClosed: true, state: 'CLOSED' });
    const project = createMockProject();

    const revertedCount = await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).toHaveBeenCalledWith(
      issue.url,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue,
      'awaiting-workspace-id',
    );
    expect(revertedCount).toBe(1);
  });

  it('does nothing for an issue that is still open and was never reopened', async () => {
    const issue = createMockIssue({ isClosed: false, stateReason: null });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does nothing for a closed issue whose status is Done, not Awaiting Owner', async () => {
    const issue = createMockIssue({
      status: DONE_STATUS_NAME,
      isClosed: true,
    });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does nothing for a closed pull request item', async () => {
    const issue = createMockIssue({
      isPr: true,
      isClosed: true,
      url: 'https://github.com/user/repo/pull/1',
    });
    const project = createMockProject();

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reopen or update when the live staleness check reports status changed since the snapshot', async () => {
    const issue = createMockIssue({ isClosed: true });
    const project = createMockProject();
    mockIssueRepository.get.mockResolvedValue(
      buildMockIssue({
        url: issue.url,
        status: AWAITING_WORKSPACE_STATUS_NAME,
      }),
    );

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reopen or update when the live staleness check reports isClosed changed since the snapshot', async () => {
    const issue = createMockIssue({ isClosed: true });
    const project = createMockProject();
    mockIssueRepository.get.mockResolvedValue(
      buildMockIssue({ url: issue.url, isClosed: false }),
    );

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not reopen or update when the live staleness check reports stateReason changed since the snapshot', async () => {
    const issue = createMockIssue({ isClosed: true, stateReason: null });
    const project = createMockProject();
    mockIssueRepository.get.mockResolvedValue(
      buildMockIssue({
        url: issue.url,
        isClosed: true,
        stateReason: 'COMPLETED',
      }),
    );

    await useCase.run({ project, issues: [issue] });

    expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('collects a failure for one closed issue and still reverts the other, then rejects naming the failure', async () => {
    const failingIssue = createMockIssue({
      number: 1,
      url: 'https://github.com/user/repo/issues/1',
      itemId: 'item-1',
      isClosed: true,
    });
    const succeedingIssue = createMockIssue({
      number: 2,
      url: 'https://github.com/user/repo/issues/2',
      itemId: 'item-2',
      isClosed: true,
    });
    const project = createMockProject();
    mockIssueRepository.updateStatus.mockImplementation(
      (_project: Project, issue: Issue) =>
        issue.url === failingIssue.url
          ? Promise.reject(new Error('simulated updateStatus failure'))
          : Promise.resolve(undefined),
    );

    const runPromise = useCase.run({
      project,
      issues: [failingIssue, succeedingIssue],
    });

    await expect(runPromise).rejects.toBeInstanceOf(Error);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      succeedingIssue,
      'awaiting-workspace-id',
    );
  });

  describe('an issue already reopened (stateReason REOPENED) by a prior incomplete run', () => {
    it('reverts the Status to Awaiting Workspace without calling reopenIssueByUrl again when no comment satisfying isAgentComment follows the latest reopened event', async () => {
      const latestReopenedAt = new Date('2026-10-02T10:00:00Z');
      const issue = createMockIssue({
        isClosed: false,
        state: 'OPEN',
        stateReason: 'REOPENED',
      });
      const project = createMockProject();
      mockIssueRepository.getLatestReopenedEventAt.mockResolvedValue(
        latestReopenedAt,
      );
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment({
          content: 'Any update on this?',
          createdAt: new Date('2026-10-01T00:00:00Z'),
        }),
      ]);

      await useCase.run({ project, issues: [issue] });

      expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        issue,
        'awaiting-workspace-id',
      );
    });

    it('leaves the issue untouched when a comment satisfying isAgentComment follows the latest reopened event, as that is a fresh legitimate Awaiting Owner cycle', async () => {
      const latestReopenedAt = new Date('2026-10-02T10:00:00Z');
      const issue = createMockIssue({
        isClosed: false,
        state: 'OPEN',
        stateReason: 'REOPENED',
      });
      const project = createMockProject();
      mockIssueRepository.getLatestReopenedEventAt.mockResolvedValue(
        latestReopenedAt,
      );
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment({
          content: AGENT_REPORT_BODY,
          createdAt: new Date('2026-10-03T00:00:00Z'),
        }),
      ]);

      await useCase.run({
        project,
        issues: [issue],
        allowedIssueAuthors: ['HiromiShikata'],
      });

      expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('reverts the Status to Awaiting Workspace when a comment matching isAgentComment\'s content pattern is posted by the issue\'s own hostile author and that author is not in allowedIssueAuthors, proving the fresh-agent-comment check cannot be defeated by the issue author impersonating an agent', async () => {
      const latestReopenedAt = new Date('2026-10-02T10:00:00Z');
      const issue = createMockIssue({
        author: 'maliciousUser',
        isClosed: false,
        state: 'OPEN',
        stateReason: 'REOPENED',
      });
      const project = createMockProject();
      mockIssueRepository.getLatestReopenedEventAt.mockResolvedValue(
        latestReopenedAt,
      );
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment({
          author: 'maliciousUser',
          content: AGENT_REPORT_BODY,
          createdAt: new Date('2026-10-03T00:00:00Z'),
        }),
      ]);

      await useCase.run({
        project,
        issues: [issue],
        allowedIssueAuthors: ['HiromiShikata'],
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        issue,
        'awaiting-workspace-id',
      );
      expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
    });

    it('leaves the issue untouched when getLatestReopenedEventAt resolves to null', async () => {
      const issue = createMockIssue({
        isClosed: false,
        state: 'OPEN',
        stateReason: 'REOPENED',
      });
      const project = createMockProject();
      mockIssueRepository.getLatestReopenedEventAt.mockResolvedValue(null);
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      try {
        await useCase.run({ project, issues: [issue] });

        expect(mockIssueRepository.reopenIssueByUrl).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining(issue.url),
        );
      } finally {
        consoleWarnSpy.mockRestore();
      }
    });
  });
});
