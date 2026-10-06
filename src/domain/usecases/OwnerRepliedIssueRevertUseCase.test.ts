import { OwnerRepliedIssueRevertUseCase } from './OwnerRepliedIssueRevertUseCase';
import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import { REACTIVATION_TRIGGER_COMMENT_HEAD } from './dependencyNotificationCommentHeads';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';
import { Comment } from '../entities/Comment';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';

const OWNER_LOGIN = 'HiromiShikata';
const ALLOWED_ISSUE_AUTHORS = [OWNER_LOGIN];
const UNTRUSTED_LOGIN = 'outside-contributor';
const AWAITING_WORKSPACE_OPTION_ID = 'awaiting-workspace-option-id';

const AGENT_REPORT_BODY =
  'From: :robot: developer (example-model)\n\nThe implementation is waiting for the owner decision.\n\n```json\n{"needOwnerConfirmationOrApproval": true}\n```';
const AGENT_PREFIXED_BODY_WITHOUT_JSON =
  'From: :robot: leader (example-model)\n\nThe fleet patrol found this issue waiting for the owner.';
const AGENT_PREFIXED_BODY_WITHOUT_JSON_AFTER_LEADING_WHITESPACE = `\n\n  ${AGENT_PREFIXED_BODY_WITHOUT_JSON}`;
const JSON_ONLY_AGENT_REPORT_BODY = '```json\n{"nextStepAgent": null}\n```';
const OWNER_REPLY_BODY = 'Why was this routed to me?';
const AUTO_STATUS_CHECK_BODY = `${AUTO_STATUS_CHECK_MESSAGE_HEAD} CONFLICT\nThis pull request has a merge conflict and has been returned to Awaiting Workspace.`;
const REACTIVATION_TRIGGER_BODY = `${REACTIVATION_TRIGGER_COMMENT_HEAD}\nNext Action Date: 2026-10-04`;
const ESTIMATION_FIELD_CLEARED_BODY =
  '`Remaining Estimation Minutes` field value `120` is removed to re-estimate.';

const awaitingWorkspaceStatusOption: FieldOption = {
  id: AWAITING_WORKSPACE_OPTION_ID,
  name: AWAITING_WORKSPACE_STATUS_NAME,
  color: 'BLUE',
  description: '',
};
const awaitingOwnerStatusOption: FieldOption = {
  id: 'awaiting-owner-option-id',
  name: AWAITING_OWNER_STATUS_NAME,
  color: 'GREEN',
  description: '',
};
const preparationStatusOption: FieldOption = {
  id: 'preparation-option-id',
  name: PREPARATION_STATUS_NAME,
  color: 'YELLOW',
  description: '',
};

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/example-org/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      awaitingWorkspaceStatusOption,
      awaitingOwnerStatusOption,
      preparationStatusOption,
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'example-org/example-repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: AWAITING_OWNER_STATUS_NAME,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/example-org/example-repo/issues/1',
  assignees: [OWNER_LOGIN],
  labels: [],
  org: 'example-org',
  repo: 'example-repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  author: OWNER_LOGIN,
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: 'developer',
  stateReason: null,
  ...overrides,
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

const commentsWithOwnerReplyAfterAgentReport = (): Comment[] => [
  createComment({
    content: AGENT_REPORT_BODY,
    createdAt: new Date('2026-10-02T08:40:52Z'),
  }),
  createComment({
    content: OWNER_REPLY_BODY,
    createdAt: new Date('2026-10-03T01:15:07Z'),
  }),
];

describe('OwnerRepliedIssueRevertUseCase', () => {
  let mockIssueRepository: {
    updateStatus: jest.Mock;
    get: jest.Mock;
    removeIssueFromProjectCache: jest.Mock;
  };
  let mockIssueCommentRepository: {
    getCommentsFromIssue: jest.Mock;
  };
  let project: Project;
  let useCase: OwnerRepliedIssueRevertUseCase;

  beforeEach(() => {
    jest.resetAllMocks();
    project = createMockProject();
    mockIssueRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockImplementation((issueUrl: string) =>
        Promise.resolve(
          createMockIssue({
            url: issueUrl,
            status: AWAITING_OWNER_STATUS_NAME,
          }),
        ),
      ),
      removeIssueFromProjectCache: jest.fn().mockResolvedValue(undefined),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
    };
    useCase = new OwnerRepliedIssueRevertUseCase(
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('writes the Awaiting Workspace option through updateStatus after the stale check reads the live item when the owner replied after the newest agent report', async () => {
    const issue = createMockIssue();
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
      commentsWithOwnerReplyAfterAgentReport(),
    );

    await expect(
      useCase.run({
        project,
        issues: [issue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      }),
    ).resolves.toBeUndefined();

    expect(
      mockIssueCommentRepository.getCommentsFromIssue,
    ).toHaveBeenCalledWith(issue);
    expect(mockIssueRepository.get).toHaveBeenCalledWith(issue.url, project);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      issue,
      AWAITING_WORKSPACE_OPTION_ID,
    );
    expect(mockIssueRepository.get.mock.invocationCallOrder[0]).toBeLessThan(
      mockIssueRepository.updateStatus.mock.invocationCallOrder[0],
    );
  });

  describe('decides from the comment timeline whether the owner replied after the newest agent comment', () => {
    const commentTimelineCases: {
      name: string;
      comments: Comment[];
      isRevertExpected: boolean;
    }[] = [
      {
        name: 'reverts when the owner replied after the newest agent report',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
            updatedAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'reverts when the agent edited its newest comment after the owner reply',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
            updatedAt: new Date('2026-10-03T06:25:32Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'does not revert when the owner comment is older than the createdAt of the newest agent comment',
        comments: [
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'reverts when an agent edited an older comment after the owner reply',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
            updatedAt: new Date('2026-10-03T06:25:32Z'),
          }),
          createComment({
            content: AGENT_PREFIXED_BODY_WITHOUT_JSON,
            createdAt: new Date('2026-10-02T13:57:56Z'),
            updatedAt: new Date('2026-10-02T14:25:16Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'does not revert when a From robot comment without JSON follows the owner reply',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
          createComment({
            content: AGENT_PREFIXED_BODY_WITHOUT_JSON,
            createdAt: new Date('2026-10-03T06:25:32Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the last comment is a From robot comment without JSON and no owner comment follows the newest agent comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: AGENT_PREFIXED_BODY_WITHOUT_JSON,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'reverts when the owner replied after a From robot comment without JSON that is the newest agent comment',
        comments: [
          createComment({
            content: AGENT_PREFIXED_BODY_WITHOUT_JSON,
            createdAt: new Date('2026-10-02T13:57:56Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'does not revert when a From robot comment preceded by leading whitespace follows the owner reply',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
          createComment({
            content: AGENT_PREFIXED_BODY_WITHOUT_JSON_AFTER_LEADING_WHITESPACE,
            createdAt: new Date('2026-10-03T06:25:32Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'reverts when the owner replied after an agent report that carries only a fenced JSON object',
        comments: [
          createComment({
            content: JSON_ONLY_AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'does not revert when an agent report that carries only a fenced JSON object follows the owner reply',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
          createComment({
            content: JSON_ONLY_AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-03T06:25:32Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the only comment after the newest agent comment is an Auto Status Check comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: AUTO_STATUS_CHECK_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the only comment after the newest agent comment is a reactivation trigger comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: REACTIVATION_TRIGGER_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the only comment after the newest agent comment is an estimation field cleared comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: ESTIMATION_FIELD_CLEARED_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'reverts when an Auto Status Check comment follows the owner reply because it is not an agent comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
          createComment({
            content: AUTO_STATUS_CHECK_BODY,
            createdAt: new Date('2026-10-03T06:25:32Z'),
          }),
        ],
        isRevertExpected: true,
      },
      {
        name: 'does not revert when there is no agent comment and only owner comments',
        comments: [
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: 'Any update on this?',
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the issue has no comments',
        comments: [],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the owner comment createdAt equals the createdAt of an edited newest agent comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
            updatedAt: new Date('2026-10-03T06:25:32Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the owner comment createdAt equals the createdAt of an unedited newest agent comment',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
            updatedAt: new Date('2026-10-03T01:15:07Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the comment after the newest agent comment is from an author outside allowedIssueAuthors',
        comments: [
          createComment({
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            author: UNTRUSTED_LOGIN,
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
      {
        name: 'does not revert when the only agent report comes from an author outside allowedIssueAuthors',
        comments: [
          createComment({
            author: UNTRUSTED_LOGIN,
            content: AGENT_REPORT_BODY,
            createdAt: new Date('2026-10-02T08:40:52Z'),
          }),
          createComment({
            content: OWNER_REPLY_BODY,
            createdAt: new Date('2026-10-03T01:15:07Z'),
          }),
        ],
        isRevertExpected: false,
      },
    ];

    it.each(commentTimelineCases)('$name', async (testCase) => {
      const issue = createMockIssue();
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        testCase.comments,
      );

      await expect(
        useCase.run({
          project,
          issues: [issue],
          allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
        }),
      ).resolves.toBeUndefined();

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
        testCase.isRevertExpected
          ? [[project, issue, AWAITING_WORKSPACE_OPTION_ID]]
          : [],
      );
    });
  });

  describe('skips items that are not open Awaiting Owner issues without fetching their comments', () => {
    const ineligibleIssueCases: {
      name: string;
      issueOverrides: Partial<Issue>;
    }[] = [
      {
        name: 'an issue in Awaiting Workspace',
        issueOverrides: { status: AWAITING_WORKSPACE_STATUS_NAME },
      },
      {
        name: 'an issue in Preparation',
        issueOverrides: { status: PREPARATION_STATUS_NAME },
      },
      {
        name: 'an issue with no status',
        issueOverrides: { status: null },
      },
      {
        name: 'a pull request in Awaiting Owner',
        issueOverrides: {
          isPr: true,
          url: 'https://github.com/example-org/example-repo/pull/1',
        },
      },
      {
        name: 'a closed issue in Awaiting Owner',
        issueOverrides: {
          isClosed: true,
          state: 'CLOSED',
          stateReason: 'COMPLETED',
        },
      },
    ];

    it.each(ineligibleIssueCases)('$name', async (testCase) => {
      const issue = createMockIssue(testCase.issueOverrides);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        commentsWithOwnerReplyAfterAgentReport(),
      );

      await expect(
        useCase.run({
          project,
          issues: [issue],
          allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
        }),
      ).resolves.toBeUndefined();

      expect(
        mockIssueCommentRepository.getCommentsFromIssue,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('does nothing when allowedIssueAuthors names nobody', () => {
    const emptyAllowedIssueAuthorsCases: {
      name: string;
      allowedIssueAuthors: string[] | null | undefined;
    }[] = [
      { name: 'allowedIssueAuthors is null', allowedIssueAuthors: null },
      {
        name: 'allowedIssueAuthors is undefined',
        allowedIssueAuthors: undefined,
      },
      { name: 'allowedIssueAuthors is empty', allowedIssueAuthors: [] },
    ];

    it.each(emptyAllowedIssueAuthorsCases)('$name', async (testCase) => {
      const issue = createMockIssue();
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        commentsWithOwnerReplyAfterAgentReport(),
      );

      await expect(
        useCase.run({
          project,
          issues: [issue],
          allowedIssueAuthors: testCase.allowedIssueAuthors,
        }),
      ).resolves.toBeUndefined();

      expect(
        mockIssueCommentRepository.getCommentsFromIssue,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  it('does nothing when the project has no Awaiting Workspace status option', async () => {
    const projectWithoutAwaitingWorkspace = createMockProject({
      status: {
        name: 'Status',
        fieldId: 'status-field-id',
        statuses: [awaitingOwnerStatusOption, preparationStatusOption],
      },
    });
    const issue = createMockIssue();
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
      commentsWithOwnerReplyAfterAgentReport(),
    );

    await expect(
      useCase.run({
        project: projectWithoutAwaitingWorkspace,
        issues: [issue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      }),
    ).resolves.toBeUndefined();

    expect(
      mockIssueCommentRepository.getCommentsFromIssue,
    ).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  describe('does not write when the stale-snapshot check does not report the item current', () => {
    it('does not call updateStatus when the live item status is no longer Awaiting Owner', async () => {
      const issue = createMockIssue();
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        commentsWithOwnerReplyAfterAgentReport(),
      );
      mockIssueRepository.get.mockImplementation((issueUrl: string) =>
        Promise.resolve(
          createMockIssue({
            url: issueUrl,
            status: AWAITING_WORKSPACE_STATUS_NAME,
          }),
        ),
      );

      await expect(
        useCase.run({
          project,
          issues: [issue],
          allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
        }),
      ).resolves.toBeUndefined();

      expect(mockIssueRepository.get).toHaveBeenCalledWith(issue.url, project);
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('does not call updateStatus and drops the item from the project cache when the item is no longer on the project', async () => {
      const issue = createMockIssue();
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        commentsWithOwnerReplyAfterAgentReport(),
      );
      mockIssueRepository.get.mockResolvedValue(null);

      await expect(
        useCase.run({
          project,
          issues: [issue],
          allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
        }),
      ).resolves.toBeUndefined();

      expect(
        mockIssueRepository.removeIssueFromProjectCache,
      ).toHaveBeenCalledWith(project.id, issue);
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  it('writes the live issue with the resolved project item ID, not the snapshot issue with the placeholder project item ID, when the Status check reports current', async () => {
    const issue = createMockIssue({ itemId: 'placeholder-item-id' });
    const liveIssue = createMockIssue({
      url: issue.url,
      status: AWAITING_OWNER_STATUS_NAME,
      itemId: 'resolved-item-id',
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
      commentsWithOwnerReplyAfterAgentReport(),
    );
    mockIssueRepository.get.mockResolvedValue(liveIssue);

    await expect(
      useCase.run({
        project,
        issues: [issue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      }),
    ).resolves.toBeUndefined();

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      liveIssue,
      AWAITING_WORKSPACE_OPTION_ID,
    );
  });

  it('skips an issue whose updateStatus call throws StaleProjectItemError and still reverts the remaining issues without throwing', async () => {
    const staleIssue = createMockIssue({
      number: 1,
      url: 'https://github.com/example-org/example-repo/issues/1',
      itemId: 'item-1',
    });
    const otherIssue = createMockIssue({
      number: 2,
      url: 'https://github.com/example-org/example-repo/issues/2',
      itemId: 'item-2',
    });
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
      commentsWithOwnerReplyAfterAgentReport(),
    );
    mockIssueRepository.get.mockImplementation((issueUrl: string) =>
      Promise.resolve(issueUrl === staleIssue.url ? staleIssue : otherIssue),
    );
    mockIssueRepository.updateStatus.mockImplementation(
      (_project: Project, issue: Issue) =>
        issue.url === staleIssue.url
          ? Promise.reject(new StaleProjectItemError('item-1'))
          : Promise.resolve(undefined),
    );

    await expect(
      useCase.run({
        project,
        issues: [staleIssue, otherIssue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      }),
    ).resolves.toBeUndefined();

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      project,
      otherIssue,
      AWAITING_WORKSPACE_OPTION_ID,
    );
  });

  describe('keeps processing the other issues when one issue fails, then rejects naming the failed issue', () => {
    const failingIssue = createMockIssue({
      number: 1,
      url: 'https://github.com/example-org/example-repo/issues/1',
      itemId: 'item-1',
    });
    const succeedingIssue = createMockIssue({
      number: 2,
      url: 'https://github.com/example-org/example-repo/issues/2',
      itemId: 'item-2',
    });

    const singleFailureCases: {
      name: string;
      arrangeFailureForIssueUrl: (failingIssueUrl: string) => void;
    }[] = [
      {
        name: 'getCommentsFromIssue rejects for the first issue',
        arrangeFailureForIssueUrl: (failingIssueUrl) => {
          mockIssueCommentRepository.getCommentsFromIssue.mockImplementation(
            (issue: Issue) =>
              issue.url === failingIssueUrl
                ? Promise.reject(
                    new Error('simulated getCommentsFromIssue failure'),
                  )
                : Promise.resolve(commentsWithOwnerReplyAfterAgentReport()),
          );
        },
      },
      {
        name: 'updateStatus rejects for the first issue',
        arrangeFailureForIssueUrl: (failingIssueUrl) => {
          mockIssueRepository.updateStatus.mockImplementation(
            (_project: Project, issue: Issue) =>
              issue.url === failingIssueUrl
                ? Promise.reject(new Error('simulated updateStatus failure'))
                : Promise.resolve(undefined),
          );
        },
      },
      {
        name: 'the stale-snapshot read issueRepository.get rejects for the first issue',
        arrangeFailureForIssueUrl: (failingIssueUrl) => {
          mockIssueRepository.get.mockImplementation((issueUrl: string) =>
            issueUrl === failingIssueUrl
              ? Promise.reject(
                  new Error('simulated issueRepository.get failure'),
                )
              : Promise.resolve(succeedingIssue),
          );
        },
      },
    ];

    it.each(singleFailureCases)('$name', async (testCase) => {
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        commentsWithOwnerReplyAfterAgentReport(),
      );
      mockIssueRepository.get.mockImplementation((issueUrl: string) =>
        Promise.resolve(
          issueUrl === failingIssue.url ? failingIssue : succeedingIssue,
        ),
      );
      testCase.arrangeFailureForIssueUrl(failingIssue.url);

      const runPromise = useCase.run({
        project,
        issues: [failingIssue, succeedingIssue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      });

      await expect(runPromise).rejects.toBeInstanceOf(Error);
      await expect(runPromise).rejects.toThrow(failingIssue.url);
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        project,
        succeedingIssue,
        AWAITING_WORKSPACE_OPTION_ID,
      );
    });

    it('rejects with an Error naming every failed issue while still reverting the issue between them', async () => {
      const secondFailingIssue = createMockIssue({
        number: 3,
        url: 'https://github.com/example-org/example-repo/issues/3',
        itemId: 'item-3',
      });
      const failingIssueUrls = [failingIssue.url, secondFailingIssue.url];
      mockIssueCommentRepository.getCommentsFromIssue.mockImplementation(
        (issue: Issue) =>
          failingIssueUrls.includes(issue.url)
            ? Promise.reject(
                new Error('simulated getCommentsFromIssue failure'),
              )
            : Promise.resolve(commentsWithOwnerReplyAfterAgentReport()),
      );
      mockIssueRepository.get.mockImplementation((issueUrl: string) =>
        Promise.resolve(
          issueUrl === succeedingIssue.url ? succeedingIssue : failingIssue,
        ),
      );

      const runPromise = useCase.run({
        project,
        issues: [failingIssue, succeedingIssue, secondFailingIssue],
        allowedIssueAuthors: ALLOWED_ISSUE_AUTHORS,
      });

      await expect(runPromise).rejects.toBeInstanceOf(Error);
      await expect(runPromise).rejects.toThrow(failingIssue.url);
      await expect(runPromise).rejects.toThrow(secondFailingIssue.url);
      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
        [project, succeedingIssue, AWAITING_WORKSPACE_OPTION_ID],
      ]);
    });
  });
});
