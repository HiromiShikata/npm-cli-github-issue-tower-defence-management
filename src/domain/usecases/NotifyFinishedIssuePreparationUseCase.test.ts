import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { AGENT_FIELD_NAME } from '../entities/RequiredProjectField';

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
      {
        id: 'todo-by-human-id',
        name: 'Todo by human',
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
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
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
    updateAgentList: jest.Mock;
    createField: jest.Mock;
  };
  let mockIssueRepository: {
    get: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    updateLabels: jest.Mock;
    getOrCreateLabel: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getStoryObjectMap: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    approvePullRequest: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
    setDependedIssueUrl: jest.Mock;
    setIssueAgentField: jest.Mock;
    searchIssue: jest.Mock;
    createNewIssue: jest.Mock;
    createCommentByUrl: jest.Mock;
    updateNextActionDate: jest.Mock;
    updateStory: jest.Mock;
    addIssueToProject: jest.Mock;
    getIssueByUrl: jest.Mock;
  };
  let mockIssueCommentRepository: {
    getCommentsFromIssue: jest.Mock;
    createComment: jest.Mock;
  };
  let mockWebhookRepository: {
    sendGetRequest: jest.Mock;
  };
  let mockProject: Project;

  afterEach(() => {
    jest.useRealTimers();
  });

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
      updateAgentList: jest.fn().mockResolvedValue([]),
      createField: jest.fn().mockResolvedValue(undefined),
    };

    mockIssueRepository = {
      getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
      get: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      updateLabels: jest.fn().mockResolvedValue(undefined),
      getOrCreateLabel: jest.fn().mockResolvedValue(undefined),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/1',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]),
      getOpenPullRequest: jest.fn(),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      approvePullRequest: jest.fn().mockResolvedValue(undefined),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
      setDependedIssueUrl: jest.fn(),
      setIssueAgentField: jest.fn().mockResolvedValue(undefined),
      searchIssue: jest.fn().mockResolvedValue([]),
      createNewIssue: jest.fn().mockResolvedValue(42),
      createCommentByUrl: jest.fn().mockResolvedValue(undefined),
      updateNextActionDate: jest.fn().mockResolvedValue(undefined),
      updateStory: jest.fn().mockResolvedValue(undefined),
      addIssueToProject: jest.fn().mockResolvedValue(undefined),
      getIssueByUrl: jest.fn().mockResolvedValue(null),
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
      allowedIssueAuthors: ['test-user'],
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
      createMockComment({ content: 'From: :robot: agent (model)' }),
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
      allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
      }),
    ).rejects.toThrow(
      'Issue not found: https://github.com/user/repo/issues/999',
    );
  });

  it('should throw IssueNotFoundError when a pull request URL has no backing project item (no silent skip)', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(null);

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/pull/999',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      }),
    ).rejects.toThrow('Issue not found: https://github.com/user/repo/pull/999');
    expect(mockIssueRepository.update).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('should read the issue scoped to the project it was given and throw IssueNotFoundError when the issue has no item on that project', async () => {
    const issueUrlOnAnotherProjectOnly =
      'https://github.com/user/repo/issues/7';
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockImplementation(
      async (issueUrl: string, project: Project) =>
        project.id === mockProject.id
          ? null
          : createMockIssue({ url: issueUrl, status: 'Preparation' }),
    );

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: issueUrlOnAnotherProjectOnly,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      }),
    ).rejects.toThrow(`Issue not found: ${issueUrlOnAnotherProjectOnly}`);
    expect(mockIssueRepository.get.mock.calls).toEqual([
      [issueUrlOnAnotherProjectOnly, mockProject],
    ]);
    expect(mockIssueRepository.update).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should process a pull request URL the same as an issue URL when the project item resolves', async () => {
    const prIssue = createMockIssue({
      url: 'https://github.com/user/repo/pull/77',
      number: 77,
      status: 'Preparation',
      isPr: true,
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(prIssue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({ content: 'From: :robot: agent (model)' }),
    ]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/77',
      isConflicted: false,
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isResolvedAllReviewComments: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/pull/77',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.get).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/77',
      mockProject,
    );
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/pull/77',
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({
        url: 'https://github.com/user/repo/pull/77',
        status: 'Awaiting Quality Check',
      }),
      'awaiting-quality-check-id',
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
        allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
        'Issue has dependent issue URLs:\n- https://github.com/user/repo/issues/2\n- https://github.com/user/repo/issues/3',
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
      allowedIssueAuthors: ['test-user'],
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
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 10, 0, 0));
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
      allowedIssueAuthors: ['test-user'],
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
      expect.stringContaining('Reactivation trigger not yet reached:'),
    );
  });

  it('should set status to Awaiting Workspace when issue has nextActionHour set', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 8, 0, 0));
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
      allowedIssueAuthors: ['test-user'],
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

  it('should not send issue back to Awaiting Workspace when nextActionDate is today or earlier', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 10, 0, 0));
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      nextActionDate: new Date(2026, 10, 1),
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      'awaiting-quality-check-id',
    );
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'awaiting-workspace-id',
    );
  });

  it('should not send issue back to Awaiting Workspace when nextActionHour has already been reached', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 1, 10, 0, 0));
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      nextActionHour: 9,
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      'awaiting-quality-check-id',
    );
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'awaiting-workspace-id',
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
          'From: :robot: agent (model)\n```json\n{"nextStep": "Fix the tests"}\n```',
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
      allowedIssueAuthors: ['test-user'],
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
        content:
          'From: :robot: agent (model)\n```json\n{"nextStep": null}\n```',
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should set agent custom field and return to Awaiting Workspace when report has nextStepAgent', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      org: 'user',
      repo: 'repo',
      labels: [],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": "llm-agent:chore", "nextStep": null}\n```',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Workspace' }),
      mockProject,
    );
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('should comment the repeated dispatch when the declared nextStepAgent is already the agent field value', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'accounting',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: triager\n```json\n{"nextStepAgent": "accounting", "nextStep": null}\n```',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Next step agent dispatch repeated: accounting'),
    );
  });

  it('should end the dispatch loop when the dispatched agent reports with the prefix behind a leading fenced json block', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'accounting',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: triager\n```json\n{"nextStepAgent": "accounting", "nextStep": null}\n```',
      }),
      createMockComment({
        content:
          'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE\nThe report declared that this task needs no pull request.',
      }),
      createMockComment({
        content:
          '```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n\nFrom: :robot: accounting (model)\n\n## Result\nDone.',
      }),
    ]);
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Awaiting Quality Check',
      }),
      mockProject,
    );
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Next step agent dispatch repeated: accounting'),
    );
  });

  it('should escalate to Failed Preparation when the declared nextStepAgent was already dispatched up to the threshold without a report', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'accounting',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: triager\n```json\n{"nextStepAgent": "accounting", "nextStep": null}\n```',
      }),
      createMockComment({
        content: 'Next step agent dispatch repeated: accounting',
      }),
      createMockComment({
        content: 'Next step agent dispatch repeated: accounting',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'failed-preparation-id',
    );
    expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(
        'Failed to receive a report from the dispatched agent for 3 times',
      ),
    );
  });

  it('should escalate to Failed Preparation when two agents keep naming each other and each one reports every round', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'systems-analyst',
    });
    const namesReviewer = createMockComment({
      content:
        'From: :robot: systems-analyst\n```json\n{"nextStepAgent": "system-design-reviewer"}\n```',
    });
    const namesAnalyst = createMockComment({
      content:
        'From: :robot: system-design-reviewer\n```json\n{"nextStepAgent": "systems-analyst"}\n```',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      namesReviewer,
      namesAnalyst,
      namesReviewer,
      namesAnalyst,
      namesReviewer,
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'failed-preparation-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(
        'dispatched 3 times since the last human comment',
      ),
    );
  });

  it('should keep dispatching when a human comment separates the repeated dispatches', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'systems-analyst',
    });
    const namesReviewer = createMockComment({
      content:
        'From: :robot: systems-analyst\n```json\n{"nextStepAgent": "system-design-reviewer"}\n```',
    });
    const namesAnalyst = createMockComment({
      content:
        'From: :robot: system-design-reviewer\n```json\n{"nextStepAgent": "systems-analyst"}\n```',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      namesReviewer,
      namesAnalyst,
      createMockComment({ content: 'Please take the second option.' }),
      namesReviewer,
      namesAnalyst,
      namesReviewer,
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'failed-preparation-id',
    );
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      expect.anything(),
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('(2/3)'),
    );
  });

  it('should not modify labels when nextStepAgent is specified', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      org: 'user',
      repo: 'repo',
      labels: ['existing-label'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": "llm-agent:impl", "nextStep": null}\n```',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
  });

  it('should not add nextStepAgent label when nextStepAgent is null', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": null, "nextStep": null}\n```',
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should not create label when nextStepAgent is specified', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      org: 'user',
      repo: 'repo',
      labels: [],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": "llm-agent:new-agent", "nextStep": null}\n```',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
  });

  it('should not modify or remove labels when nextStepAgent is specified', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      org: 'user',
      repo: 'repo',
      labels: ['llm-agent:chore', 'chore', 'feature-flag'],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": "llm-agent:impl", "nextStep": null}\n```',
      }),
    ]);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/issues/1',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
      labelsAsLlmAgentName: ['chore', 'accounting'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
  });

  it('should not add nextStepAgent label when nextStepAgent is an empty string', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: agent (model)\n```json\n{"nextStepAgent": "", "nextStep": null}\n```',
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.getOrCreateLabel).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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

  it('should reject a draft PR', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.get.mockResolvedValue(issue);
    mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
      createMockComment({
        content:
          'From: :robot: Test report\n```json\n{"pullRequestRequired": false}\n```',
      }),
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/user/repo/issues/1',
      }),
      expect.stringContaining('PULL_REQUEST_IS_DRAFT'),
    );
  });

  it('should not reject a missing PR when the issue label is only in labelsNotRequiringPullRequest', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: ['story'],
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
      allowedIssueAuthors: ['test-user'],
      labelsAsLlmAgentName: ['chore', 'accounting'],
      labelsNotRequiringPullRequest: ['story'],
    });

    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
    );
  });

  it('should reject a missing PR when the issue agent matches developerAgentNames', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      agent: 'my-agent',
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
      allowedIssueAuthors: ['test-user'],
      developerAgentNames: ['my-agent'],
    });

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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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

  it('should skip PR checks and update to Awaiting Quality Check when issue has non-developer agent field', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: [],
      agent: 'chore',
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  it('should skip PR checks when issue has non-developer agent field value', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
      labels: [],
      agent: 'accounting',
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
      allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      createMockComment({ content: 'From: :robot: agent (model)' }),
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
      allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        prUrl,
        mockProject,
        'https://github.com/user/repo/issues/1',
      );
    });

    it('should not call setDependedIssueUrl when issue is a PR and the resolved PR URL matches the issue URL (self-reference prevention)', async () => {
      const prUrl = 'https://github.com/user/repo/pull/77';
      const prIssue = createMockIssue({
        url: prUrl,
        status: 'Preparation',
        isPr: true,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(prIssue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: agent (model)' }),
      ]);
      mockIssueRepository.getOpenPullRequest.mockResolvedValue({
        url: prUrl,
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isResolvedAllReviewComments: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      });

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: prUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
        allowedIssueAuthors: ['test-user'],
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
      allowedIssueAuthors: ['test-user'],
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
      createMockComment({ content: 'From: :robot: agent (model)' }),
    ]);
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
      issueUrl: 'https://github.com/user/repo/pull/10',
      thresholdForAutoReject: 3,
      workflowBlockerResolvedWebhookUrl: null,
      allowedIssueAuthors: ['test-user'],
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
        content: 'From: :robot: agent (model)\n```json\n{invalid json}\n```',
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
      allowedIssueAuthors: ['test-user'],
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
        content: 'From: :robot: agent (model)\n```json\nnull\n```',
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
      allowedIssueAuthors: ['test-user'],
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
          'From: :robot: agent (model)\n```json\n{"status": "done", "result": "success"}\n```',
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
      allowedIssueAuthors: ['test-user'],
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
        content: 'From: :robot: agent (model)\n```json\n"just a string"\n```',
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
      allowedIssueAuthors: ['test-user'],
    });

    expect(mockIssueRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Awaiting Quality Check' }),
      mockProject,
    );
  });

  describe('author verification (allowedIssueAuthors)', () => {
    it('should treat From: comment from untrusted author as NO_REPORT_FROM_AGENT_BOT', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'attacker',
          content: 'From: :robot: Fake report',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['trusted-bot'],
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
        expect.objectContaining({
          url: 'https://github.com/user/repo/issues/1',
        }),
        expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
      );
    });

    it('should accept From: comment from trusted author and route to Awaiting Quality Check', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'trusted-bot',
          content: 'From: :robot: Real report',
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
        allowedIssueAuthors: ['trusted-bot'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        mockProject,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        'awaiting-quality-check-id',
      );
    });

    it('should not auto-escalate to Failed Preparation when REJECTED comments come from untrusted authors', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'attacker',
          content: 'Auto Status Check: REJECTED - first',
        }),
        createMockComment({
          author: 'attacker',
          content: 'Auto Status Check: REJECTED - second',
        }),
        createMockComment({
          author: 'attacker',
          content: 'Auto Status Check: REJECTED - third',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['trusted-bot'],
      });

      expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalledWith(
        mockProject,
        expect.anything(),
        'failed-preparation-id',
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
    });

    it('should auto-escalate to Failed Preparation when REJECTED comments come from trusted authors', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - first',
        }),
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - second',
        }),
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - third',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['trusted-bot'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Failed Preparation' }),
        'failed-preparation-id',
      );
    });

    it('should ignore attacker-injected "failed to pass the check automatically" string and still escalate when trusted REJECTED comments meet threshold', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - first',
        }),
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - second',
        }),
        createMockComment({
          author: 'attacker',
          content: 'failed to pass the check automatically',
        }),
        createMockComment({
          author: 'trusted-bot',
          content: 'Auto Status Check: REJECTED - third',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['trusted-bot'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Failed Preparation' }),
        'failed-preparation-id',
      );
    });

    it('should reject author not in allowedIssueAuthors list (fail-closed)', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'arbitrary-user',
          content: 'From: :robot: Report',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['trusted-bot'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/repo/issues/1',
        }),
        expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
      );
    });

    it('should reject all authors when allowedIssueAuthors is omitted (fail-closed)', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'arbitrary-user',
          content: 'From: :robot: Report',
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
    });
  });

  describe('change-target label auto-approve', () => {
    const setupApprovedPrScenario = (issueOverrides: Partial<Issue> = {}) => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        ...issueOverrides,
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: agent (model)' }),
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
    };

    it('should not approve PR when issue has no change-target label', async () => {
      setupApprovedPrScenario();

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        mockProject,
      );
    });

    it('should approve PR when issue has change-target label and all files are confined', async () => {
      setupApprovedPrScenario({ labels: ['change-target:src/domain'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'src/domain/usecases/Bar.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        mockProject,
      );
    });

    it('should not approve PR when any changed file is outside the labeled path', async () => {
      setupApprovedPrScenario({ labels: ['change-target:src/domain'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'src/adapter/repositories/Outside.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        mockProject,
      );
    });

    it('should approve when files are confined under any of multiple change-target labels', async () => {
      setupApprovedPrScenario({
        labels: ['change-target:src/domain', 'change-target:docs'],
      });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
        'docs/intro.md',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should not approve when PR has more than 100 changed files and one file beyond entry 100 is outside the labeled path', async () => {
      setupApprovedPrScenario({ labels: ['change-target:src/domain'] });
      const filePaths: string[] = [];
      for (let i = 0; i < 150; i += 1) {
        filePaths.push(`src/domain/file${i}.ts`);
      }
      filePaths.push('src/adapter/Outside.ts');
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue(
        filePaths,
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should match boundary-safely (change-target:foo matches foo/bar.ts but not foobar/baz.ts)', async () => {
      setupApprovedPrScenario({ labels: ['change-target:foo'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'foo/bar.ts',
        'foobar/baz.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should approve when changed files match exact path or subpath of the labeled path', async () => {
      setupApprovedPrScenario({ labels: ['change-target:foo'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'foo/bar.ts',
        'foo/nested/baz.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should not approve when PR has zero changed files', async () => {
      setupApprovedPrScenario({ labels: ['change-target:src/domain'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).toHaveBeenCalledWith('https://github.com/user/repo/pull/1');
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should not approve when there is no approved PR even if change-target label is present', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        labels: ['change-target:src/domain'],
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: agent (model)' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockIssueRepository.getPullRequestChangedFilePaths,
      ).not.toHaveBeenCalled();
      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });

    it('should normalize trailing slashes in change-target label paths', async () => {
      setupApprovedPrScenario({ labels: ['change-target:src/domain/'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should normalize leading slashes in change-target label paths', async () => {
      setupApprovedPrScenario({ labels: ['change-target:/src/domain'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/entities/Foo.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should expand changeTargetPathAliases when alias matches a change-target label', async () => {
      setupApprovedPrScenario({ labels: ['change-target:adapters'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/usecases/adapter-interfaces/IssueRepository.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        changeTargetPathAliases: {
          adapters: 'src/domain/usecases/adapter-interfaces',
        },
      });

      expect(mockIssueRepository.approvePullRequest).toHaveBeenCalledWith(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should not approve when file is outside the alias-expanded path', async () => {
      setupApprovedPrScenario({ labels: ['change-target:adapters'] });
      mockIssueRepository.getPullRequestChangedFilePaths.mockResolvedValue([
        'src/domain/usecases/SomeOtherUseCase.ts',
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        changeTargetPathAliases: {
          adapters: 'src/domain/usecases/adapter-interfaces',
        },
      });

      expect(mockIssueRepository.approvePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('nextStepAgent handling', () => {
    const makeProjectWithAgent = () =>
      createMockProject({
        agent: {
          name: 'Agent',
          fieldId: 'agent-field-id',
          options: [
            { id: 'opt-impl', name: 'impl', color: 'GRAY', description: '' },
          ],
        },
      });

    it('calls setIssueAgentField with existing option ID when nextStepAgent is in last comment', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      const projectWithAgent = makeProjectWithAgent();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStep": null, "nextStepAgent": "impl"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
        projectWithAgent,
        'opt-impl',
      );
    });

    it('does not call setIssueAgentField when the latest bot report carries no declaration of its own', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      const projectWithAgent = makeProjectWithAgent();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStep": null, "nextStepAgent": "impl"}\n```',
        }),
        createMockComment({
          content:
            'From: :robot: agent (model)\n\n## PR URL\nhttps://github.com/user/repo/pull/2\n',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });

    it('creates a new agent option and calls setIssueAgentField when nextStepAgent is not an existing option', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      const projectWithAgent = makeProjectWithAgent();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStep": null, "nextStepAgent": "chore"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);
      mockProjectRepository.updateAgentList.mockResolvedValue([
        { id: 'opt-impl', name: 'impl', color: 'GRAY', description: '' },
        { id: 'opt-chore-new', name: 'chore', color: 'GRAY', description: '' },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockProjectRepository.updateAgentList).toHaveBeenCalledWith(
        projectWithAgent,
        expect.arrayContaining([
          expect.objectContaining({ name: 'impl' }),
          expect.objectContaining({ id: null, name: 'chore', color: 'GRAY' }),
        ]),
      );
      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
        projectWithAgent,
        'opt-chore-new',
      );
    });

    it('does not call setIssueAgentField when nextStepAgent is absent from the last comment', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      const projectWithAgent = makeProjectWithAgent();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStep": null}\n```',
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
      expect(mockProjectRepository.updateAgentList).not.toHaveBeenCalled();
    });

    it('creates agent field via createField and does not call setIssueAgentField when project has no agent field and re-fetch also returns no agent', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      const projectWithoutAgent = createMockProject({ agent: null });
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithoutAgent);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStep": null, "nextStepAgent": "impl"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockProjectRepository.createField).toHaveBeenCalledWith(
        projectWithoutAgent,
        {
          name: AGENT_FIELD_NAME,
          dataType: 'SINGLE_SELECT',
          options: [{ name: 'impl', color: 'GRAY', description: '' }],
        },
      );
      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });
  });

  describe('consoleTabsRepository integration', () => {
    let mockConsoleTabsRepository: {
      patchIssueTabTransition: jest.Mock;
    };

    beforeEach(() => {
      mockConsoleTabsRepository = {
        patchIssueTabTransition: jest.fn(),
      };
      useCase = new NotifyFinishedIssuePreparationUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
        mockWebhookRepository,
        mockConsoleTabsRepository,
      );
    });

    it('calls patchIssueTabTransition with prs tab when issue transitions to Awaiting Quality Check', async () => {
      const issue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-1',
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: report' }),
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockConsoleTabsRepository.patchIssueTabTransition,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          projectItemId: 'item-1',
          targetTabName: 'prs',
        }),
      );
    });

    it('calls patchIssueTabTransition with null tab when issue transitions to Awaiting Workspace', async () => {
      const issue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-2',
        dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(
        mockConsoleTabsRepository.patchIssueTabTransition,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          projectItemId: 'item-2',
          targetTabName: null,
        }),
      );
    });

    it('passes relatedOpenPullRequestUrls from findRelatedOpenPRs into the prs tab item', async () => {
      const issue = createMockIssue({
        status: 'Preparation',
        itemId: 'item-1',
        isPr: false,
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/42',
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
      ]);
      let capturedArg: unknown = undefined;
      mockConsoleTabsRepository.patchIssueTabTransition.mockImplementation(
        (arg: unknown) => {
          capturedArg = arg;
        },
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(capturedArg).toMatchObject({
        targetTabName: 'prs',
        item: {
          relatedOpenPullRequestUrls: ['https://github.com/user/repo/pull/42'],
        },
      });
    });

    it('does not call patchIssueTabTransition when consoleTabsRepository is not provided', async () => {
      useCase = new NotifyFinishedIssuePreparationUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
        mockWebhookRepository,
      );
      const issue = createMockIssue({
        status: 'Preparation',
        dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
      });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          issueUrl: 'https://github.com/user/repo/issues/1',
          thresholdForAutoReject: 3,
          workflowBlockerResolvedWebhookUrl: null,
          allowedIssueAuthors: ['test-user'],
        }),
      ).resolves.not.toThrow();
      expect(
        mockConsoleTabsRepository.patchIssueTabTransition,
      ).not.toHaveBeenCalled();
    });
  });

  describe('when missingAgentName is provided', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';
    const taskIssueTitle = 'Register missing agent definition: impl';
    const taskIssueUrl = 'https://github.com/user/repo/issues/42';

    it('creates a task issue and sets depended issue URL when no existing open task issue exists', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
        sessionErrorLine:
          "Error: Agent 'impl' not found at /path/agents/impl.md",
      });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith({
        owner: 'user',
        repositoryName: 'repo',
        type: 'issue',
        state: 'open',
        title: taskIssueTitle,
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.stringContaining(issueUrl),
        ['alice'],
        [],
      );
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.stringContaining('impl'),
        ['alice'],
        [],
      );
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.stringContaining(
          "Error: Agent 'impl' not found at /path/agents/impl.md",
        ),
        ['alice'],
        [],
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.stringContaining('From: :robot:'),
        ['alice'],
        [],
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        taskIssueUrl,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining('impl'),
      );
    });

    it('reuses an existing open task issue and does not create a new one', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: taskIssueUrl,
          title: taskIssueTitle,
          number: '42',
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        taskIssueUrl,
      );
    });

    it('skips setDependedIssueUrl when project has no dependedIssueUrlSeparatedByComma field but still creates the task issue and returns to Awaiting Workspace', async () => {
      const projectWithoutDependedField = createMockProject({
        dependedIssueUrlSeparatedByComma: null,
      });
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithoutDependedField,
      );
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        projectWithoutDependedField,
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        'awaiting-workspace-id',
      );
    });

    it('uses (not captured) as error line when sessionErrorLine is not provided', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.stringContaining('(not captured)'),
        ['alice'],
        [],
      );
    });

    it('passes the manager as the assignee to createNewIssue when manager is provided', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.any(String),
        ['alice'],
        [],
      );
    });

    it('throws an error and does not call createNewIssue when manager is absent', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          issueUrl,
          thresholdForAutoReject: 3,
          workflowBlockerResolvedWebhookUrl: null,
          allowedIssueAuthors: ['test-user'],
          missingAgentName: 'impl',
        }),
      ).rejects.toThrow('manager');

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('creates the task issue in the tdpmReportingRepository owner/repo when configured', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
        tdpmReportingRepository: 'tdpm-owner/tdpm-repo',
      });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith({
        owner: 'tdpm-owner',
        repositoryName: 'tdpm-repo',
        type: 'issue',
        state: 'open',
        title: taskIssueTitle,
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'tdpm-owner',
        'tdpm-repo',
        taskIssueTitle,
        expect.stringContaining(issueUrl),
        ['alice'],
        [],
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        'https://github.com/tdpm-owner/tdpm-repo/issues/99',
      );
    });

    it('falls back to the product repo when tdpmReportingRepository is not configured', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        missingAgentName: 'impl',
        manager: 'alice',
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        taskIssueTitle,
        expect.any(String),
        ['alice'],
        [],
      );
    });
  });

  describe('when deferPreparation is true', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';

    it('sets nextActionDate to start of tomorrow and returns item to Awaiting Workspace without creating any issue', async () => {
      const now = new Date('2026-08-24T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        deferPreparation: true,
      });

      expect(mockIssueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateNextActionDate).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        new Date('2026-08-25T00:00:00'),
      );

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        'awaiting-workspace-id',
      );

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(1);
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining('2026-08-25'),
      );

      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
    });

    it('takes precedence over missingAgentName and defers without creating any issue', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        deferPreparation: true,
        missingAgentName: 'some-agent',
        manager: 'alice',
      });

      expect(mockIssueRepository.updateNextActionDate).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.setDependedIssueUrl).not.toHaveBeenCalled();
    });

    it('does not defer when deferPreparation is false', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        deferPreparation: false,
      });

      expect(mockIssueRepository.updateNextActionDate).not.toHaveBeenCalled();
    });

    it('states the session stop reason in the deferral comment', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        deferPreparation: true,
        sessionErrorLine:
          'Task failed 3 consecutive times with terminal_reason=api_error',
      });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(1);
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining(
          'Task failed 3 consecutive times with terminal_reason=api_error',
        ),
      );
    });

    it('states that no stop reason was captured when sessionErrorLine is absent', async () => {
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        deferPreparation: true,
      });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining('(not captured)'),
      );
    });
  });

  describe('nextStepAgent validation against agents list', () => {
    it('creates a workflow blocker issue and returns original task to Awaiting Workspace when nextStepAgent is not in configured agents list', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const blockerIssueUrl = 'https://github.com/user/repo/issues/42';
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        expect.stringContaining('unknown-agent'),
        expect.stringContaining(issueUrl),
        [],
        [],
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalledWith(
        'user',
        'repo',
        expect.stringContaining('unknown-agent'),
        expect.stringContaining('From: :robot:'),
        [],
        [],
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        blockerIssueUrl,
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
      expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        'awaiting-workspace-id',
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining(blockerIssueUrl),
      );
    });

    it('sets workflow blocker story on the created blocker issue when project has a matching story', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const blockerIssueUrl = 'https://github.com/user/repo/issues/42';
      const blockerStoryId = 'blocker-story-id';
      const projectWithStory = createMockProject({
        dependedIssueUrlSeparatedByComma: {
          name: 'Depended Issue URL',
          fieldId: 'depended-field-id',
        },
        story: {
          name: 'Story',
          fieldId: 'story-field-id',
          databaseId: 1,
          stories: [
            {
              id: blockerStoryId,
              name: 'workflow blocker',
              color: 'RED',
              description: '',
            },
            {
              id: 'regular-story-id',
              name: 'regular / workflow improvement',
              color: 'BLUE',
              description: '',
            },
          ],
          workflowManagementStory: {
            id: 'wms-id',
            name: 'workflow management',
          },
        },
      });
      const blockerIssueObject = createMockIssue({
        url: blockerIssueUrl,
        itemId: 'blocker-item-id',
      });
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(projectWithStory);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);
      mockIssueRepository.getIssueByUrl.mockResolvedValue(blockerIssueObject);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.addIssueToProject).toHaveBeenCalledWith(
        projectWithStory,
        blockerIssueUrl,
      );
      expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
        expect.objectContaining({ story: projectWithStory.story }),
        blockerIssueObject,
        blockerStoryId,
      );
    });

    it('reuses an existing open blocker issue instead of creating a new one', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const existingBlockerUrl = 'https://github.com/user/repo/issues/99';
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: existingBlockerUrl,
          title: 'Unregistered agent in workflow configuration: unknown-agent',
          number: '99',
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        existingBlockerUrl,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ url: issueUrl }),
        expect.stringContaining(existingBlockerUrl),
      );
    });

    it('skips story assignment when project has no story field', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const projectWithoutStory = createMockProject({
        dependedIssueUrlSeparatedByComma: {
          name: 'Depended Issue URL',
          fieldId: 'depended-field-id',
        },
        story: null,
      });
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(projectWithoutStory);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.addIssueToProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        projectWithoutStory,
      );
    });

    it('skips story assignment when no workflow blocker story option exists in project', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const projectWithNoBlockerStory = createMockProject({
        dependedIssueUrlSeparatedByComma: {
          name: 'Depended Issue URL',
          fieldId: 'depended-field-id',
        },
        story: {
          name: 'Story',
          fieldId: 'story-field-id',
          databaseId: 1,
          stories: [
            {
              id: 'regular-story-id',
              name: 'regular / workflow improvement',
              color: 'BLUE',
              description: '',
            },
          ],
          workflowManagementStory: {
            id: 'wms-id',
            name: 'workflow management',
          },
        },
      });
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithNoBlockerStory,
      );
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.addIssueToProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        projectWithNoBlockerStory,
      );
    });

    it('creates the blocker issue in tdpmReportingRepository when configured', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
        tdpmReportingRepository: 'tdpm-owner/tdpm-repo',
      });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith({
        owner: 'tdpm-owner',
        repositoryName: 'tdpm-repo',
        type: 'issue',
        state: 'open',
        title: 'Unregistered agent in workflow configuration: unknown-agent',
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'tdpm-owner',
        'tdpm-repo',
        expect.stringContaining('unknown-agent'),
        expect.stringContaining(issueUrl),
        [],
        [],
      );
      expect(mockIssueRepository.setDependedIssueUrl).toHaveBeenCalledWith(
        issueUrl,
        mockProject,
        'https://github.com/tdpm-owner/tdpm-repo/issues/99',
      );
    });

    it('falls back to product repo when tdpmReportingRepository is not configured', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        expect.stringContaining('unknown-agent'),
        expect.any(String),
        [],
        [],
      );
    });

    it('falls back to product repo and warns when tdpmReportingRepository is malformed', async () => {
      const issueUrl = 'https://github.com/user/repo/issues/1';
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "unknown-agent"}\n```',
        }),
      ]);
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(42);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
        tdpmReportingRepository: 'owner/repo/extra',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('owner/repo/extra'),
      );
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'user',
        'repo',
        expect.stringContaining('unknown-agent'),
        expect.any(String),
        [],
        [],
      );

      consoleWarnSpy.mockRestore();
    });

    it('should dispatch normally when nextStepAgent is in the configured agents list', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "developer"}\n```',
        }),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: ['developer', 'triager'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
      expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
    });

    it('should skip nextStepAgent validation when agents list is null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "any-arbitrary-agent"}\n```',
        }),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
      expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
    });

    it('should skip nextStepAgent validation when agents list is empty', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: test-agent (model)\n```json\n{"nextStepAgent": "any-arbitrary-agent"}\n```',
        }),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        agents: [],
      });

      expect(mockIssueRepository.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Failed Preparation' }),
        mockProject,
      );
    });
  });

  describe('allowedIssueAuthors fail-closed behavior', () => {
    it('should reject agent reports from any author when allowedIssueAuthors is null (fail-closed)', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          author: 'any-author',
          content: 'From: :robot: Real report',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        mockProject,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/repo/issues/1',
        }),
        expect.stringContaining('NO_REPORT_FROM_AGENT_BOT'),
      );
    });
  });

  describe('waitingForOwnerApproval', () => {
    const issueUrl = 'https://github.com/user/repo/issues/1';

    it('writes no status at all when the project has no Awaiting Quality Check option', async () => {
      const projectWithoutQualityCheck = {
        ...mockProject,
        status: {
          ...mockProject.status,
          statuses: mockProject.status.statuses.filter(
            (status) => status.name !== 'Awaiting Quality Check',
          ),
        },
      };
      const issue = createMockIssue({ url: issueUrl, status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithoutQualityCheck,
      );
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: systems-analyst (model)\n```json\n{"pullRequestRequired": false, "waitingForOwnerApproval": true}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl,
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    });
  });

  describe('non-developer agent CI failure reassignment', () => {
    const makeProjectWithDeveloper = (developerName = 'developer') =>
      createMockProject({
        dependedIssueUrlSeparatedByComma: {
          name: 'Depended Issue URL',
          fieldId: 'depended-field-id',
        },
        agent: {
          name: 'Agent',
          fieldId: 'agent-field-id',
          options: [
            {
              id: 'opt-developer',
              name: developerName,
              color: 'GRAY',
              description: '',
            },
          ],
        },
      });

    it('should return issue to Awaiting Workspace and reassign to developer when chore agent has exactly one linked PR with failing CI', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'chore',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        projectWithDeveloper,
      );
      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
        projectWithDeveloper,
        'opt-developer',
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
        expect.stringContaining('https://github.com/user/repo/pull/99'),
      );
    });

    it('should advance to Awaiting Quality Check when chore agent has exactly one linked PR where all CI passes', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'chore',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        projectWithDeveloper,
      );
      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });

    it('should not trigger reassignment when chore agent has no linked PRs', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'chore',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        projectWithDeveloper,
      );
    });

    it('should not trigger the new path when developer agent has a failing CI PR', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'developer',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        projectWithDeveloper,
      );
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/repo/issues/1',
        }),
        expect.stringContaining('ANY_CI_JOB_FAILED_OR_IN_PROGRESS'),
      );
    });

    it('should reassign to the first configured developerAgentNames when chore agent has a failing CI PR', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'chore',
      });
      const projectWithCustomDeveloper =
        makeProjectWithDeveloper('custom-developer');
      mockProjectRepository.getByUrl.mockResolvedValue(
        projectWithCustomDeveloper,
      );
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: null,
        developerAgentNames: ['custom-developer'],
      });

      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
        projectWithCustomDeveloper,
        'opt-developer',
      );
    });

    it('should not trigger the new path when agent is null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: null,
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });

    it('should not trigger the new path when agent is pr-reviewer', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'pr-reviewer',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
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
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });

    it('should not trigger the new path when chore agent has two failing CI linked PRs', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'chore',
      });
      const projectWithDeveloper = makeProjectWithDeveloper();
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithDeveloper);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: Test report' }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        {
          url: 'https://github.com/user/repo/pull/99',
          isConflicted: false,
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        },
        {
          url: 'https://github.com/user/repo/pull/100',
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
        allowedIssueAuthors: null,
      });

      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });
  });
  describe('routing a finished preparation by the designated next step agent', () => {
    const projectWithAgent = () =>
      createMockProject({
        agent: {
          name: AGENT_FIELD_NAME,
          fieldId: 'agent-field-id',
          options: [
            { id: 'opt-impl', name: 'impl', color: 'GRAY', description: '' },
          ],
        },
      });

    it('should move the issue to Awaiting Quality Check without touching the agent field when no next step agent is designated', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent());
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({ content: 'From: :robot: agent (model)' }),
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Quality Check' }),
        expect.anything(),
      );
      expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    });

    it('should set the agent field and return the issue to Awaiting Workspace when a next step agent is designated', async () => {
      const project = projectWithAgent();
      const issue = createMockIssue({ status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(project);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStepAgent": "impl"}\n```',
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
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/user/repo/issues/1',
        project,
        'opt-impl',
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        project,
      );
    });

    it('should waive the missing pull request rejection when the designated next step agent is the triager', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent());
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStepAgent": "triager"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
      );
      expect(mockIssueRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Awaiting Workspace' }),
        expect.anything(),
      );
    });

    it('should keep the missing pull request rejection when the designated next step agent is not the triager', async () => {
      const issue = createMockIssue({ status: 'Preparation' });
      mockProjectRepository.getByUrl.mockResolvedValue(projectWithAgent());
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createMockComment({
          content:
            'From: :robot: agent (model)\n```json\n{"nextStepAgent": "impl"}\n```',
        }),
      ]);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
      });

      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('PULL_REQUEST_NOT_FOUND'),
      );
      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'awaiting-workspace-id',
      );
    });
  });

  describe('workflow issue reporting for silent redispatch', () => {
    const silentRedispatchComments = () => [
      createMockComment({
        content:
          'From: :robot: triager\n```json\n{"nextStepAgent": "accounting", "nextStep": null}\n```',
      }),
      createMockComment({
        content: 'Next step agent dispatch repeated: accounting',
      }),
      createMockComment({
        content: 'Next step agent dispatch repeated: accounting',
      }),
    ];

    it('should create a new workflow issue when workflowIssueReporterSettings is provided and no existing issue found', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'accounting',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        silentRedispatchComments(),
      );
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: {
          owner: 'workflow-owner',
          repo: 'workflow-repo',
        },
      });

      expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'workflow-owner',
          repositoryName: 'workflow-repo',
          title: 'TDPM agent not reporting: accounting',
          state: 'open',
        }),
      );
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'workflow-owner',
        'workflow-repo',
        'TDPM agent not reporting: accounting',
        expect.stringContaining('accounting'),
        [],
        [],
      );
    });

    it('should comment on existing workflow issue when one is found', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'accounting',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        silentRedispatchComments(),
      );
      mockIssueRepository.searchIssue.mockResolvedValue([
        {
          url: 'https://github.com/workflow-owner/workflow-repo/issues/5',
          title: 'TDPM agent not reporting: accounting',
          number: '5',
        },
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: {
          owner: 'workflow-owner',
          repo: 'workflow-repo',
        },
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
      expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
        'https://github.com/workflow-owner/workflow-repo/issues/5',
        expect.stringContaining('accounting'),
      );
    });

    it('should NOT create a workflow issue for dispatch loop escalation', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'systems-analyst',
      });
      const namesReviewer = createMockComment({
        content:
          'From: :robot: systems-analyst\n```json\n{"nextStepAgent": "system-design-reviewer"}\n```',
      });
      const namesAnalyst = createMockComment({
        content:
          'From: :robot: system-design-reviewer\n```json\n{"nextStepAgent": "systems-analyst"}\n```',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        namesReviewer,
        namesAnalyst,
        namesReviewer,
        namesAnalyst,
        namesReviewer,
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: {
          owner: 'workflow-owner',
          repo: 'workflow-repo',
        },
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.anything(),
        'failed-preparation-id',
      );
      expect(mockIssueRepository.searchIssue).not.toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'workflow-owner' }),
      );
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalledWith(
        'workflow-owner',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should NOT create a workflow issue when workflowIssueReporterSettings is null', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'accounting',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        silentRedispatchComments(),
      );

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: null,
      });

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        mockProject,
        expect.anything(),
        'failed-preparation-id',
      );
      expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
    });

    it('should add new workflow issue to project and set workflow blocker story when projectUrl is provided', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'accounting',
      });
      const createdIssue = createMockIssue({
        url: 'https://github.com/workflow-owner/workflow-repo/issues/99',
        status: 'Todo by human',
      });
      const reporterProject = createMockProject({
        story: {
          name: 'Story',
          fieldId: 'story-field-id',
          databaseId: 123,
          stories: [
            {
              id: 'workflow-blocker-story-id',
              name: 'regular / workflow blocker',
              color: 'RED',
              description: '',
            },
          ],
          workflowManagementStory: {
            id: 'wm-story-id',
            name: 'regular / workflow management',
          },
        },
      });

      mockProjectRepository.getByUrl
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce(reporterProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        silentRedispatchComments(),
      );
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);
      mockIssueRepository.getIssueByUrl.mockResolvedValue(createdIssue);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: {
          owner: 'workflow-owner',
          repo: 'workflow-repo',
          projectUrl: 'https://github.com/orgs/workflow-owner/projects/5',
        },
      });

      expect(mockIssueRepository.addIssueToProject).toHaveBeenCalledWith(
        reporterProject,
        'https://github.com/workflow-owner/workflow-repo/issues/99',
      );
      expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
        { ...reporterProject, story: reporterProject.story },
        createdIssue,
        'workflow-blocker-story-id',
      );
    });

    it('should NOT call addIssueToProject when projectUrl is not set', async () => {
      const issue = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
        agent: 'accounting',
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue(
        silentRedispatchComments(),
      );
      mockIssueRepository.searchIssue.mockResolvedValue([]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);

      await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
        thresholdForAutoReject: 3,
        workflowBlockerResolvedWebhookUrl: null,
        allowedIssueAuthors: ['test-user'],
        workflowIssueReporterSettings: {
          owner: 'workflow-owner',
          repo: 'workflow-repo',
        },
      });

      expect(mockIssueRepository.addIssueToProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'workflow-blocker-story-id',
      );
    });
  });
});
