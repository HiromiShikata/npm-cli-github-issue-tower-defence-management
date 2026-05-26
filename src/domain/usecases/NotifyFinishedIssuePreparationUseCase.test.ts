import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';
import { StoryObjectMap } from '../entities/StoryObjectMap';

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'failed-preparation-id',
        name: 'Failed Preparation',
        color: 'RED',
        description: '',
      },
      {
        id: 'awaiting-quality-check-id',
        name: 'Awaiting Quality Check',
        color: 'BLUE',
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
  ...overrides,
});

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Preparation',
  story: null,
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
  ...overrides,
});

const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
  author: 'test-user',
  content: 'From: :robot: Test comment',
  createdAt: new Date(),
  ...overrides,
});

describe('NotifyFinishedIssuePreparationUseCase', () => {
  let useCase: NotifyFinishedIssuePreparationUseCase;
  let mockProjectRepository: {
    getByUrl: jest.Mock;
  };
  let mockIssueRepository: {
    get: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getStoryObjectMap: jest.Mock;
    getOpenPullRequest: jest.Mock;
    setDependedIssueUrl: jest.Mock;
  };
  let mockIssueCommentRepository: {
    getCommentsFromIssue: jest.Mock;
    createComment: jest.Mock;
  };
  let mockWebhookRepository: {
    sendGetRequest: jest.Mock;
  };
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();

    mockProject = createMockProject({
      dependedIssueUrlSeparatedByComma: {
        name: 'Depended Issue URL',
        fieldId: 'depended-field-id',
      },
    });

    mockProjectRepository = {
      getByUrl: jest.fn(),
    };

    mockIssueRepository = {
      getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
      get: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
      setDependedIssueUrl: jest.fn(),
    };

    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn(),
      createComment: jest.fn(),
    };

    mockWebhookRepository = {
      sendGetRequest: jest.fn(),
    };

    useCase = new NotifyFinishedIssuePreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
      mockWebhookRepository,
    );
  });

  it('should update issue status from Preparation to Awaiting Quality Check when last comment starts with From:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Awaiting Quality Check',
      }),
      'awaiting-quality-check-id',
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/1',
      mockProject,
      'https://github.com/user/repo/issues/1',
    );
  });

  it('should call setDependedIssueUrl for an approved PR when checks pass', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    const prUrl = 'https://github.com/user/repo/pull/42';

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Agent report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: prUrl,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      prUrl,
      mockProject,
      'https://github.com/user/repo/issues/1',
    );
  });

  it('should throw IssueNotFoundError when issue does not exist', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/999',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      }),
    ).rejects.toThrow(
      'Issue not found: https://github.com/user/repo/issues/999',
    );
  });

  it('should throw IllegalIssueStatusError when issue status is not Preparation', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Done',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      }),
    ).rejects.toThrow(
      'Illegal issue status for https://github.com/user/repo/issues/1: expected Preparation, but got Done',
    );
  });

  it('should set status to Awaiting Workspace when issue has dependent issue URLs', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      dependedIssueUrls: [
        'https://github.com/user/repo/issues/2',
        'https://github.com/user/repo/issues/3',
      ],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining(
        'Issue has dependent issue URLs: https://github.com/user/repo/issues/2, https://github.com/user/repo/issues/3',
      ),
    );
  });

  it('should enrich dependedIssueUrls from storyObjectMap when issue has none', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      dependedIssueUrls: [],
    });

    const storyObjectMap: StoryObjectMap = new Map();
    storyObjectMap.set('Some Story', {
      story: {
        id: 'story-1',
        name: 'Some Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [
        createMockIssue({
          url: 'https://github.com/user/repo/issues/1',
          dependedIssueUrls: ['https://github.com/user/repo/issues/5'],
        }),
      ],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining('Issue has dependent issue URLs:'),
    );
  });

  it('should set status to Awaiting Workspace when issue has nextActionDate set', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      nextActionDate: new Date('2026-12-01'),
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining('Issue has next action date or hour set:'),
    );
  });

  it('should set status to Awaiting Workspace when issue has nextActionHour set', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      nextActionHour: 9,
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining('nextActionHour=9'),
    );
  });

  it('should reject and set status to Awaiting Workspace when last comment starts with Auto Status Check:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'Auto Status Check: REJECTED\n["NO_REPORT"]',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('Auto Status Check: REJECTED'),
    );
  });

  it('should reject when last comment does not start with From:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Some other comment' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });

  it('should reject with NO_REPORT_FROM_AGENT_BOT when last comment is a cross-issue notification starting with From: :warning:', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :warning: This message is from https://github.com/user/repo/tree/i999 AI HS Implement AI Agent (claude-sonnet-4-6)',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });

  it('should reject and set status to Awaiting Workspace when no comments exist', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalled();
  });

  it('should reject when last comment has REPORT_HAS_NEXT_STEP', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: Agent report\n```json\n{"nextStep": "Fix the tests"}\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining('REPORT_HAS_NEXT_STEP'),
    );
  });

  it('should not reject when last comment has nextStep set to null', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'From: :robot: Agent report\n```json\n{"nextStep": null}\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should auto-escalate to Failed Preparation after threshold rejections', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Failed Preparation',
      }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Failed Preparation' }),
      'failed-preparation-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('Auto Status Check:'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining(
        'Failed to pass the check automatically for 3 times',
      ),
    );
  });

  it('should advance to Awaiting Quality Check and skip escalation when current check passes even if prior rejection threshold is met', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    const prUrl = 'https://github.com/user/repo/pull/1';

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({ content: 'From: :robot: Agent final report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: prUrl,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Failed Preparation' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining(
        'Failed to pass the check automatically for 3 times',
      ),
    );
    expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
      prUrl,
      mockProject,
      'https://github.com/user/repo/issues/1',
    );
  });

  it('should not auto-escalate when rejections are below threshold', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
  });

  it('should not auto-escalate when failed-to-pass-check comment exists even if threshold met', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({
        content:
          'Auto Status Check: REJECTED\n\nFailed to pass the check automatically for 3 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should handle case-insensitive failed-to-pass-check comment', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - fourth' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - fifth' }),
      createMockComment({
        content:
          'AUTO STATUS CHECK: APPROVED\n\nFailed to pass the check automatically for 5 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should not auto-escalate when new-format escalation comment with Auto Status Check prefix exists', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'Auto Status Check: REJECTED - first' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - second' }),
      createMockComment({ content: 'Auto Status Check: REJECTED - third' }),
      createMockComment({
        content:
          'Auto Status Check: APPROVED (escalated due to prior failures)\n\nFailed to pass the check automatically for 3 times',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should reject when PR is not found', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should reject when multiple PRs are found', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
      {
        url: 'https://github.com/user/repo/pull/2',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('MULTIPLE_PULL_REQUESTS_FOUND'),
    );
  });

  it('should reject when PR is conflicted', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: true,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_CONFLICTED'),
    );
  });

  it('should reject when CI job failed', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
    );
  });

  it('should reject with REQUIRED_CI_JOB_NEVER_STARTED when required checks are missing', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: ['E2E Tests', 'deploy-preview'],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('REQUIRED_CI_JOB_NEVER_STARTED'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('E2E Tests'),
    );
  });

  it('should reject with ANY_CI_JOB_FAILED_OR_IN_PROGRESS when CI has failures and required checks are also missing', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: ['deploy-preview'],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('deploy-preview'),
    );
  });

  it('should include PR URL in rejection comment details', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('https://github.com/user/repo/pull/1'),
    );
  });

  it('should reject when review comments are not resolved', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: false,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('ANY_REVIEW_COMMENT_NOT_RESOLVED'),
    );
  });

  it('should reject when PR is in draft state', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isDraft: true,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_IS_DRAFT'),
    );
  });

  it('should skip PR checks and update to Awaiting Quality Check when issue has category label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:frontend'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should check PRs when issue has category:e2e label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:e2e'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.findRelatedOpenPRs).toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
  });

  it('should still check for report comment even when issue has category label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['category:backend'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'Auto Status Check: REJECTED\n["NO_REPORT"]',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Workspace',
      }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });

  it('should skip PR checks and update to Awaiting Quality Check when issue has llm-agent label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['llm-agent'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should skip PR checks when issue has llm-agent: prefixed label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['llm-agent:claude'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should still check for report comment even when issue has llm-agent:research label', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['llm-agent:research'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'Auto Status Check: REJECTED\n["NO_REPORT"]',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/issues/1' }),
      expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
    );
  });

  it('should use getOpenPullRequest when issue is a PR item', async () => {
    const prIssue = createMockIssue({
      url: 'https://github.com/user/repo/pull/10',
      status: 'Preparation',
      isPr: true,
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(prIssue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Agent report' }),
    ]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/10',
      isConflicted: false,
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/pull/10',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/10',
    );
    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  describe('setDependedIssueUrl for open PRs', () => {
    it('should call setDependedIssueUrl for a non-approved PR', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prUrl = 'https://github.com/user/repo/pull/10';

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Agent report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: prUrl,
          isConflicted: false,
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
    });

    it('should call setDependedIssueUrl for an approved PR', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prUrl = 'https://github.com/user/repo/pull/20';

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Agent report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: prUrl,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
    });

    it('should call setDependedIssueUrl for multiple PRs when multiple are linked to the issue', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prUrl1 = 'https://github.com/user/repo/pull/30';
      const prUrl2 = 'https://github.com/user/repo/pull/31';

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Agent report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: prUrl1,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
        {
          url: prUrl2,
          isConflicted: true,
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isResolvedAllReviewComments: false,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl1,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl2,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(2);
    });

    it('should delegate the skip-if-already-set check to the repository (setDependedIssueUrl is always called per PR)', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      const prUrl = 'https://github.com/user/repo/pull/40';

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Agent report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: prUrl,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.setDependedIssueUrl.mockResolvedValue(undefined);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
    });

    it('should log a warning and skip setDependedIssueUrl when dependedIssueUrlSeparatedByComma is not configured in project', async () => {
      const projectWithoutDependedField = createMockProject({
        dependedIssueUrlSeparatedByComma: null,
      });
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithoutDependedField,
      );
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: Agent report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/10',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dependedIssueUrlSeparatedByComma'),
      );
      expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('workflow blocker webhook notification', () => {
    const createWorkflowBlockerStoryObjectMap = (
      issueUrl: string,
    ): StoryObjectMap => {
      const map: StoryObjectMap = new Map();
      map.set('Workflow Blocker Story', {
        story: {
          id: 'story-1',
          name: 'Workflow Blocker Story',
          color: 'GRAY',
          description: '',
        },
        storyIssue: null,
        issues: [createMockIssue({ url: issueUrl })],
      });
      return map;
    };

    const createNonBlockerStoryObjectMap = (): StoryObjectMap => {
      const map: StoryObjectMap = new Map();
      map.set('Regular Story', {
        story: {
          id: 'story-2',
          name: 'Regular Story',
          color: 'GRAY',
          description: '',
        },
        storyIssue: null,
        issues: [
          createMockIssue({
            url: 'https://github.com/user/repo/issues/99',
          }),
        ],
      });
      return map;
    };

    it('should send webhook when workflow blocker issue status changes to awaitingQualityCheckStatus on checks pass', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?url={URL}&msg={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledWith(
        `https://example.com/webhook?url=${encodeURIComponent('https://github.com/user/repo/issues/1')}&msg=${encodeURIComponent('Workflow blocker resolved: https://github.com/user/repo/issues/1')}`,
      );
    });

    it('should send webhook when workflow blocker issue auto-escalates', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content: 'Auto Status Check: REJECTED - first',
        }),
        createMockComment({
          content: 'Auto Status Check: REJECTED - second',
        }),
        createMockComment({
          content: 'Auto Status Check: REJECTED - third',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/notify={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledTimes(1);
      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/notify='),
      );
    });

    it('should not send webhook for non-blocker issues', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createNonBlockerStoryObjectMap(),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?msg={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalled();
    });

    it('should not send webhook when URL is null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
      });

      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalled();
    });

    it('should log warning and not block workflow when webhook fails', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );
      mockWebhookRepository.sendGetRequest.mockRejectedValue(
        new Error('Network error'),
      );

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/webhook?msg={MESSAGE}',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to send workflow blocker notification:',
        expect.any(Error),
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Awaiting Quality Check',
        }),
        mockProject,
      );

      consoleWarnSpy.mockRestore();
    });

    it('should URL-encode placeholders in webhook URL', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createWorkflowBlockerStoryObjectMap(
          'https://github.com/user/repo/issues/1',
        ),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl:
          'https://example.com/runTasker/notify=:={MESSAGE}',
      });

      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledTimes(1);
      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('{MESSAGE}'),
      );
      expect(mockWebhookRepository.sendGetRequest).not.toHaveBeenCalledWith(
        expect.stringContaining('{URL}'),
      );
      expect(mockWebhookRepository.sendGetRequest).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent('Workflow blocker resolved:'),
        ),
      );
    });
  });

  it('should continue and not enrich dependedIssueUrls when getStoryObjectMap throws', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      dependedIssueUrls: [],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueRepository.getStoryObjectMap.mockRejectedValue(
      new Error('Story map unavailable'),
    );
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Test report' }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to enrich dependedIssueUrls from story object map:',
      expect.any(Error),
    );
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );

    consoleWarnSpy.mockRestore();
  });

  it('should return no PRs when getOpenPullRequest returns null for a PR item', async () => {
    const prIssue = createMockIssue({
      url: 'https://github.com/user/repo/pull/10',
      status: 'Preparation',
      isPr: true,
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(prIssue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: Agent report' }),
    ]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/pull/10',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/10',
    );
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://github.com/user/repo/pull/10' }),
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should not reject REPORT_HAS_NEXT_STEP when report JSON is invalid', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'From: :robot: Agent report\n```json\n{invalid json}\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should not reject REPORT_HAS_NEXT_STEP when report JSON is null', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'From: :robot: Agent report\n```json\nnull\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should not reject REPORT_HAS_NEXT_STEP when report JSON has no nextStep property', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: Agent report\n```json\n{"status": "done", "result": "success"}\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should not reject REPORT_HAS_NEXT_STEP when report JSON is a non-object value', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content: 'From: :robot: Agent report\n```json\n"just a string"\n```',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      {
        url: 'https://github.com/user/repo/pull/1',
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });
});
