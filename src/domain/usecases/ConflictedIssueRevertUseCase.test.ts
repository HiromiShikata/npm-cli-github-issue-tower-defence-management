import { ConflictedIssueRevertUseCase } from './ConflictedIssueRevertUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { RelatedPullRequest } from './adapter-interfaces/IssueRepository';

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
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'in-progress-id',
        name: 'In Tmux by agent',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
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
  status: 'In Tmux by agent',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: ['user'],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: 'user',
  closingIssueReferenceUrls: [],
  agent: null,
  ...overrides,
});

const createMockPrIssue = (
  issueUrl: string,
  overrides: Partial<Issue> = {},
): Issue =>
  createMockIssue({
    title: 'Test PR',
    url: 'https://github.com/user/repo/pull/100',
    isPr: true,
    closingIssueReferenceUrls: [issueUrl],
    ...overrides,
  });

const createMockRelatedPullRequest = (
  url: string,
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url,
  branchName: 'feature-branch',
  createdAt: new Date(),
  isDraft: false,
  isConflicted: false,
  mergeable: 'MERGEABLE',
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('ConflictedIssueRevertUseCase', () => {
  let mockProjectRepository: {
    findProjectIdByUrl: jest.Mock;
    getProject: jest.Mock;
  };
  let mockIssueRepository: {
    getAllIssues: jest.Mock;
    getOpenPullRequests: jest.Mock;
    updateStatus: jest.Mock;
  };
  let mockIssueCommentRepository: {
    createComment: jest.Mock;
  };
  let mockProject: Project;
  let useCase: ConflictedIssueRevertUseCase;

  beforeEach(() => {
    jest.resetAllMocks();

    mockProject = createMockProject();

    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn().mockResolvedValue(mockProject),
    };

    mockIssueRepository = {
      getAllIssues: jest.fn().mockResolvedValue({
        project: mockProject,
        issues: [],
        cacheUsed: false,
      }),
      getOpenPullRequests: jest.fn().mockResolvedValue(new Map()),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    mockIssueCommentRepository = {
      createComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ConflictedIssueRevertUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  it('moves issue to Awaiting Workspace and posts conflict comment when linked PR is conflicted and no UNKNOWN PR', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/100',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      issue,
      'conflict',
    );
  });

  it('does not process issue in an excluded status (Awaiting Workspace)', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      status: 'Awaiting Workspace',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/101',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue in excluded status Done', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/3',
      status: 'Done',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/102',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue in excluded status Icebox', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/4',
      status: 'Icebox',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/103',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue in excluded status Failed Preparation', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/5',
      status: 'Failed Preparation',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/104',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue in excluded status In Tmux by human', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/6',
      status: 'In Tmux by human',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/105',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: true,
      mergeable: 'CONFLICTING',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue when linked PR has mergeable UNKNOWN', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/7',
      status: 'Preparation',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/106',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: false,
      mergeable: 'UNKNOWN',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue when no linked open PRs are conflicted', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/8',
      status: 'Preparation',
    });
    const prIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/107',
    });
    const prDetail = createMockRelatedPullRequest(prIssue.url, {
      isConflicted: false,
      mergeable: 'MERGEABLE',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, prIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([[prIssue.url, prDetail]]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('does not process issue with no linked open PRs', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/9',
      status: 'Preparation',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(new Map());

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('skips issue with UNKNOWN PR even when another linked PR is conflicted', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/10',
      status: 'Preparation',
    });
    const conflictedPrIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/108',
      number: 108,
    });
    const unknownPrIssue = createMockPrIssue(issue.url, {
      url: 'https://github.com/user/repo/pull/109',
      number: 109,
    });
    const conflictedPrDetail = createMockRelatedPullRequest(
      conflictedPrIssue.url,
      { isConflicted: true, mergeable: 'CONFLICTING' },
    );
    const unknownPrDetail = createMockRelatedPullRequest(unknownPrIssue.url, {
      isConflicted: false,
      mergeable: 'UNKNOWN',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [issue, conflictedPrIssue, unknownPrIssue],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([
        [conflictedPrIssue.url, conflictedPrDetail],
        [unknownPrIssue.url, unknownPrDetail],
      ]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockIssueCommentRepository.createComment).not.toHaveBeenCalled();
  });

  it('evaluates multiple issues independently in one cycle', async () => {
    const conflictedIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/11',
      status: 'Preparation',
      number: 11,
      itemId: 'item-11',
    });
    const unknownIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/12',
      status: 'Preparation',
      number: 12,
      itemId: 'item-12',
    });
    const cleanIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/13',
      status: 'Preparation',
      number: 13,
      itemId: 'item-13',
    });

    const conflictedPrIssue = createMockPrIssue(conflictedIssue.url, {
      url: 'https://github.com/user/repo/pull/110',
      number: 110,
    });
    const unknownPrIssue = createMockPrIssue(unknownIssue.url, {
      url: 'https://github.com/user/repo/pull/111',
      number: 111,
    });
    const cleanPrIssue = createMockPrIssue(cleanIssue.url, {
      url: 'https://github.com/user/repo/pull/112',
      number: 112,
    });

    const conflictedPrDetail = createMockRelatedPullRequest(
      conflictedPrIssue.url,
      { isConflicted: true, mergeable: 'CONFLICTING' },
    );
    const unknownPrDetail = createMockRelatedPullRequest(unknownPrIssue.url, {
      isConflicted: false,
      mergeable: 'UNKNOWN',
    });
    const cleanPrDetail = createMockRelatedPullRequest(cleanPrIssue.url, {
      isConflicted: false,
      mergeable: 'MERGEABLE',
    });

    mockIssueRepository.getAllIssues.mockResolvedValue({
      project: mockProject,
      issues: [
        conflictedIssue,
        unknownIssue,
        cleanIssue,
        conflictedPrIssue,
        unknownPrIssue,
        cleanPrIssue,
      ],
      cacheUsed: false,
    });
    mockIssueRepository.getOpenPullRequests.mockResolvedValue(
      new Map([
        [conflictedPrIssue.url, conflictedPrDetail],
        [unknownPrIssue.url, unknownPrDetail],
        [cleanPrIssue.url, cleanPrDetail],
      ]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/users/user/projects/1',
    });

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      conflictedIssue,
      'awaiting-workspace-id',
    );
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledTimes(1);
    expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
      conflictedIssue,
      'conflict',
    );
  });
});
