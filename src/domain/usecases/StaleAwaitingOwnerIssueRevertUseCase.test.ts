import {
  StaleAwaitingOwnerIssueRevertUseCase,
  DEFAULT_STALE_AWAITING_OWNER_THRESHOLD_MINUTES,
} from './StaleAwaitingOwnerIssueRevertUseCase';
import {
  IssueRepository,
  IssueComment,
} from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const AGENT_REPORT_BODY_WITH_CONFIRMATION =
  'From: :robot: agent (model)\n\n## Summary\n\nSome question for owner.\n\n```json\n{ "needOwnerConfirmationOrApproval": true }\n```';

const AGENT_REPORT_BODY_NO_CONFIRMATION =
  'From: :robot: agent (model)\n\n## Summary\n\nSome work done.\n\n```json\n{ "nextStepAgent": "pr-reviewer" }\n```';

const OWNER_COMMENT_BODY = 'LGTM, proceed.';

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
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
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
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

const makeIssueComment = (
  body: string,
  author: string,
  createdAt: Date,
): IssueComment => ({ body, author, createdAt });

describe('StaleAwaitingOwnerIssueRevertUseCase', () => {
  let useCase: StaleAwaitingOwnerIssueRevertUseCase;
  let mockIssueRepository: Mocked<
    Pick<
      IssueRepository,
      'updateStatus' | 'createCommentByUrl' | 'getIssueOrPullRequestComments'
    >
  >;

  const now = new Date('2024-01-02T12:00:00Z');
  const thresholdMinutes = DEFAULT_STALE_AWAITING_OWNER_THRESHOLD_MINUTES;
  const allowedIssueAuthors = ['owner-user'];

  const makeCreatedComment = (): IssueComment =>
    makeIssueComment('revert comment', 'tdpm-bot', now);

  beforeEach(() => {
    jest.resetAllMocks();
    mockIssueRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
      createCommentByUrl: jest.fn().mockResolvedValue(makeCreatedComment()),
      getIssueOrPullRequestComments: jest.fn().mockResolvedValue([]),
    };
    useCase = new StaleAwaitingOwnerIssueRevertUseCase(mockIssueRepository);
  });

  const runUseCase = (issues: Issue[], project = createMockProject()) =>
    useCase.run({
      project,
      issues,
      now,
      staleThresholdMinutes: thresholdMinutes,
      allowedIssueAuthors,
    });

  it('reverts a stale Awaiting Owner issue to Awaiting Workspace when threshold is exceeded', async () => {
    const issue = createMockIssue();
    const agentCommentTime = new Date(
      now.getTime() - (thresholdMinutes + 10) * 60 * 1000,
    );
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        AGENT_REPORT_BODY_WITH_CONFIRMATION,
        'bot',
        agentCommentTime,
      ),
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(1);
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      issue.url,
      expect.stringContaining(
        'Stale Awaiting Owner: auto-reverted to Awaiting Workspace',
      ),
    );
    const postedComment =
      mockIssueRepository.createCommentByUrl.mock.calls[0][1];
    expect(postedComment).toContain('> From: :robot: agent (model)');
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      createMockProject(),
      issue,
      'awaiting-workspace-id',
    );
  });

  it('does not revert when elapsed time is below threshold', async () => {
    const issue = createMockIssue();
    const agentCommentTime = new Date(
      now.getTime() - (thresholdMinutes - 10) * 60 * 1000,
    );
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        AGENT_REPORT_BODY_WITH_CONFIRMATION,
        'bot',
        agentCommentTime,
      ),
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not revert when owner has commented after the last agent comment', async () => {
    const issue = createMockIssue();
    const agentCommentTime = new Date(
      now.getTime() - (thresholdMinutes + 10) * 60 * 1000,
    );
    const ownerCommentTime = new Date(
      agentCommentTime.getTime() + 5 * 60 * 1000,
    );
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        AGENT_REPORT_BODY_WITH_CONFIRMATION,
        'bot',
        agentCommentTime,
      ),
      makeIssueComment(OWNER_COMMENT_BODY, 'owner-user', ownerCommentTime),
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not revert when there is no agent comment', async () => {
    const issue = createMockIssue();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        OWNER_COMMENT_BODY,
        'owner-user',
        new Date(now.getTime() - 200 * 60 * 1000),
      ),
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not revert a closed issue', async () => {
    const issue = createMockIssue({ isClosed: true });

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(
      mockIssueRepository.getIssueOrPullRequestComments,
    ).not.toHaveBeenCalled();
  });

  it('does not revert a PR item', async () => {
    const issue = createMockIssue({
      isPr: true,
      url: 'https://github.com/user/repo/pull/1',
    });

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(
      mockIssueRepository.getIssueOrPullRequestComments,
    ).not.toHaveBeenCalled();
  });

  it('does not process issues not in Awaiting Owner status', async () => {
    const issue = createMockIssue({ status: AWAITING_WORKSPACE_STATUS_NAME });

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(
      mockIssueRepository.getIssueOrPullRequestComments,
    ).not.toHaveBeenCalled();
  });

  it('skips when Awaiting Workspace status option is missing', async () => {
    const project = createMockProject();
    project.status.statuses = project.status.statuses.filter(
      (s) => s.name !== AWAITING_WORKSPACE_STATUS_NAME,
    );
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = await useCase.run({
      project,
      issues: [createMockIssue()],
      now,
      staleThresholdMinutes: thresholdMinutes,
      allowedIssueAuthors,
    });

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('skips deduplication when the same revert comment was already posted within the window', async () => {
    const issue = createMockIssue();
    const agentCommentTime = new Date(
      now.getTime() - (thresholdMinutes + 10) * 60 * 1000,
    );
    const agentComment = makeIssueComment(
      AGENT_REPORT_BODY_WITH_CONFIRMATION,
      'bot',
      agentCommentTime,
    );
    const elapsedMinutes =
      (now.getTime() - agentCommentTime.getTime()) / (1000 * 60);
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = Math.floor(elapsedMinutes % 60);
    const elapsedStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const existingRevertComment = makeIssueComment(
      `Stale Awaiting Owner: auto-reverted to Awaiting Workspace after ${elapsedStr} with no owner response.\n\n**Previous agent question**\nThe previous agent explicitly requested owner confirmation or approval. Content of the previous agent comment:\n\n${AGENT_REPORT_BODY_WITH_CONFIRMATION.split(
        '\n',
      )
        .map((l) => `> ${l}`)
        .join(
          '\n',
        )}\n\n**Guidance for next agent**\nPer \`story-gate-check\` criteria: reversible decisions — those undoable by a later pull request without external action — belong to the agent, not the owner.\nIrreversible actions (contacting external parties, spending money, altering production in a way code cannot revert) still require the owner.\nProceed autonomously for reversible choices and record your reasoning in a comment.`,
      'bot',
      new Date(now.getTime() - 30 * 60 * 1000),
    );
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      agentComment,
      existingRevertComment,
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
  });

  it('collects errors from individual issue processing and throws AggregateError', async () => {
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
    const agentCommentTime = new Date(
      now.getTime() - (thresholdMinutes + 10) * 60 * 1000,
    );
    mockIssueRepository.getIssueOrPullRequestComments
      .mockResolvedValueOnce([
        makeIssueComment(
          AGENT_REPORT_BODY_WITH_CONFIRMATION,
          'bot',
          agentCommentTime,
        ),
      ])
      .mockResolvedValueOnce([
        makeIssueComment(
          AGENT_REPORT_BODY_WITH_CONFIRMATION,
          'bot',
          agentCommentTime,
        ),
      ]);
    mockIssueRepository.createCommentByUrl
      .mockRejectedValueOnce(new Error('createComment failed for issue1'))
      .mockResolvedValueOnce(
        makeIssueComment('revert comment', 'tdpm-bot', now),
      );

    await expect(runUseCase([issue1, issue2])).rejects.toBeInstanceOf(
      AggregateError,
    );

    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledTimes(2);
  });

  it('includes elapsed time in the revert comment', async () => {
    const issue = createMockIssue();
    const agentCommentTime = new Date(now.getTime() - 90 * 60 * 1000);
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        AGENT_REPORT_BODY_WITH_CONFIRMATION,
        'bot',
        agentCommentTime,
      ),
    ]);

    await runUseCase([issue]);

    const postedComment =
      mockIssueRepository.createCommentByUrl.mock.calls[0][1];
    expect(postedComment).toContain('1h 30m');
  });

  it('uses last agent comment when multiple agent comments exist', async () => {
    const issue = createMockIssue();
    const olderAgentCommentTime = new Date(
      now.getTime() - (thresholdMinutes + 30) * 60 * 1000,
    );
    const recentAgentCommentTime = new Date(
      now.getTime() - (thresholdMinutes - 10) * 60 * 1000,
    );
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      makeIssueComment(
        AGENT_REPORT_BODY_NO_CONFIRMATION,
        'bot',
        olderAgentCommentTime,
      ),
      makeIssueComment(
        AGENT_REPORT_BODY_WITH_CONFIRMATION,
        'bot',
        recentAgentCommentTime,
      ),
    ]);

    const result = await runUseCase([issue]);

    expect(result).toBe(0);
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });
});
