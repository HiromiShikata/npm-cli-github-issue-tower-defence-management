import { StartPreparationUseCase } from './StartPreparationUseCase';
import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: 'GRAY',
      description: '',
    },
    storyIssue: null,
    issues: issues,
  });
  return map;
};

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Backlog',
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
  author: 'testuser',
  ...overrides,
});

const createMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
      { id: '2', name: 'Preparation', color: 'YELLOW', description: '' },
      { id: '3', name: 'Done', color: 'GREEN', description: '' },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

describe('StartPreparationUseCase', () => {
  let useCase: StartPreparationUseCase;
  let mockProjectRepository: Mocked<Pick<ProjectRepository, 'getByUrl'>>;
  let mockIssueRepository: Mocked<
    Pick<
      IssueRepository,
      | 'getStoryObjectMap'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'closePullRequest'
      | 'deletePullRequestBranch'
      | 'createCommentByUrl'
    >
  >;
  let mockClaudeRepository: Mocked<Pick<ClaudeRepository, 'getUsage'>>;
  let mockLocalCommandRunner: Mocked<LocalCommandRunner>;
  let mockProject: Project;
  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      getByUrl: jest.fn(),
    };
    mockIssueRepository = {
      getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
      updateStatus: jest.fn(),
      findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
      getOpenPullRequest: jest.fn().mockResolvedValue(null),
      closePullRequest: jest.fn().mockResolvedValue(undefined),
      deletePullRequestBranch: jest.fn().mockResolvedValue(undefined),
      createCommentByUrl: jest.fn().mockResolvedValue(undefined),
    };
    mockClaudeRepository = {
      getUsage: jest.fn().mockResolvedValue([]),
    };
    mockLocalCommandRunner = {
      runCommand: jest.fn(),
    };
    useCase = new StartPreparationUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockClaudeRepository,
      mockLocalCommandRunner,
    );
  });
  it('should run aw command for awaiting workspace issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('2');
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should pass --branch to aw command when issue has an existing linked PR', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const existingPR: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: 'i1',
      createdAt: new Date('2024-01-01'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([existingPR]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should pass --branch with PR branch name when issue URL is a PR URL', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/pull/354',
        title: 'PR 354',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/354',
      branchName: 'dependabot/npm_and_yarn/multi-cc382f683c',
      createdAt: new Date('2024-01-01'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'https://github.com/user/repo/pull/354',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'dependabot/npm_and_yarn/multi-cc382f683c',
      ],
    ]);
    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(mockIssueRepository.getOpenPullRequest).toHaveBeenCalledWith(
      'https://github.com/user/repo/pull/354',
    );
  });
  it('should skip and not call wrapper when PR URL returns null from getOpenPullRequest', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/pull/999',
        title: 'PR 999',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getOpenPullRequest.mockResolvedValue(null);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping non-OPEN PR https://github.com/user/repo/pull/999: wrapper requires an open PR.',
    );
    consoleWarnSpy.mockRestore();
  });
  it('should skip and not call wrapper when PR URL has open PR with null branchName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/pull/999',
        title: 'PR 999',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/999',
      branchName: null,
      createdAt: new Date('2024-01-01'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping PR https://github.com/user/repo/pull/999: head branch is unavailable.',
    );
    consoleWarnSpy.mockRestore();
  });
  it('should skip and not call wrapper when PR has branch name with shell-unsafe characters', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/pull/999',
        title: 'PR 999',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.getOpenPullRequest.mockResolvedValue({
      url: 'https://github.com/user/repo/pull/999',
      branchName: 'evil$(rm -rf /)',
      createdAt: new Date('2024-01-01'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('branch name contains unexpected characters'),
    );
    consoleErrorSpy.mockRestore();
  });
  it('should auto-resolve by adopting oldest PR, closing newer PR with branch delete and comments when issue has multiple related open PRs', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const olderPR: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: 'i1',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    const newerPR: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/43',
      branchName: 'i1-fix',
      createdAt: new Date('2024-01-02T00:00:00Z'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      olderPR,
      newerPR,
    ]);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      newerPR.url,
    );
    expect(mockIssueRepository.deletePullRequestBranch).toHaveBeenCalledWith(
      newerPR.url,
      newerPR.branchName,
    );
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      newerPR.url,
      expect.stringContaining(olderPR.url),
    );
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      'https://github.com/user/repo/issues/1',
      expect.stringContaining(newerPR.url),
    );
    expect(mockIssueRepository.closePullRequest).not.toHaveBeenCalledWith(
      olderPR.url,
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'https://github.com/user/repo/issues/1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should skip issue after resolving duplicates when adopted canonical PR has null branchName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const olderPRNullBranch: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    const newerPR: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/43',
      branchName: 'i1-fix',
      createdAt: new Date('2024-01-02T00:00:00Z'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      olderPRNullBranch,
      newerPR,
    ]);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockIssueRepository.closePullRequest).toHaveBeenCalledWith(
      newerPR.url,
    );
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      newerPR.url,
      expect.stringContaining(olderPRNullBranch.url),
    );
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      'https://github.com/user/repo/issues/1',
      expect.stringContaining(newerPR.url),
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'adopted canonical PR has unavailable head branch',
      ),
    );
    consoleWarnSpy.mockRestore();
  });
  it('should skip and not call wrapper when issue has one related open PR with null branchName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    const prWithNullBranch: RelatedPullRequest = {
      url: 'https://github.com/user/repo/pull/42',
      branchName: null,
      createdAt: new Date('2024-01-01'),
      isConflicted: false,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isResolvedAllReviewComments: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
      prWithNullBranch,
    ]);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping issue url1: related open PR has unavailable head branch.',
    );
    consoleWarnSpy.mockRestore();
  });
  it('should assign workspace to awaiting issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
      createMockIssue({
        url: 'url2',
        title: 'Issue 2',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    // Both awaiting issues should be updated (forward iteration: url1 first, then url2)
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(2);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'url1',
      status: 'Preparation',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('2');
    expect(mockIssueRepository.updateStatus.mock.calls[1][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[1][1]).toMatchObject({
      url: 'url2',
      status: 'Preparation',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[1][2]).toBe('2');
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });
  it('should stop assigning after maximum preparing issues count is reached', async () => {
    // When we already have 6 preparation issues and max is 6 (default),
    // the loop condition prevents processing any new issues
    const preparationIssues: Issue[] = Array.from({ length: 6 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Preparation',
      }),
    );
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url7',
        title: 'Issue 7',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([...preparationIssues, ...awaitingIssues]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    // Loop doesn't run because we're already at max (6 >= 6)
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
  it('should pass configFilePath to aw command', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should use configFilePath in aw command', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should use llm-agent label over category label and defaultLlmAgentName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['llm-agent:research', 'category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: 'default-llm-agent',
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'research',
        'claude-sonnet-4-6',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should use category label over defaultLlmAgentName when no llm-agent label', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: 'default-llm-agent',
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-sonnet-4-6',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should use defaultLlmAgentName over defaultAgentName when no label', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: 'default-llm-agent',
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'default-llm-agent',
        'claude-sonnet-4-6',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should use llm-model label over defaultLlmModelName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl', 'llm-model:claude-sonnet'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-sonnet',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });
  it('should log error and skip issue when no llm-model label and no defaultLlmModelName', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'No LLM model configured for issue url1. Provide --defaultLlmModelName or add an llm-model: label.',
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
  it('should continue processing subsequent issues when one issue has no model configured', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1 (no model)',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
      createMockIssue({
        url: 'url2',
        title: 'Issue 2 (with model label)',
        labels: ['category:impl', 'llm-model:claude-sonnet-4-6'],
        status: 'Awaiting Workspace',
        number: 2,
        itemId: 'item-2',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'No LLM model configured for issue url1. Provide --defaultLlmModelName or add an llm-model: label.',
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url2',
        'impl',
        'claude-sonnet-4-6',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i2',
      ],
    ]);
    consoleErrorSpy.mockRestore();
  });
  it('should handle no awaiting workspace issues gracefully', async () => {
    // Test that the loop handles an empty awaiting workspace issues array
    const preparationIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Preparation',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(preparationIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    // No issues are in 'Awaiting Workspace' status, so no updates should happen
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });
  it('should use custom maximumPreparingIssuesCount when provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: 3,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
  });
  it('should use default maximumPreparingIssuesCount of 6 when null is provided', async () => {
    const awaitingIssues: Issue[] = Array.from({ length: 12 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should not skip issues from repositories with workflow blockers', async () => {
    const blockerIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      title: 'Blocker Issue',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    const issueInBlockedRepo = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      title: 'Issue in blocked repo',
      labels: [],
      status: 'Awaiting Workspace',
      state: 'OPEN',
    });

    const workflowBlockerMap: StoryObjectMap = new Map();
    workflowBlockerMap.set('Workflow blocker', {
      story: {
        id: 'story-blocker',
        name: 'Workflow blocker',
        color: 'RED',
        description: '',
      },
      storyIssue: null,
      issues: [blockerIssue],
    });
    workflowBlockerMap.set('Default Story', {
      story: {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [issueInBlockedRepo],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(workflowBlockerMap);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(2);
    const updatedUrls = mockIssueRepository.updateStatus.mock.calls.map(
      (call) => call[1].url,
    );
    expect(updatedUrls).toContain('https://github.com/user/repo/issues/100');
    expect(updatedUrls).toContain('https://github.com/user/repo/issues/101');
  });

  it('should skip preparation when Claude usage is over 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
  });

  it('should proceed with preparation when Claude usage is under 90%', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 30, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should reduce maximumPreparingIssuesCount gradually when weekly usage window exceeds threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 50, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 91, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    const weeklyUtilization = 91;
    const threshold = 90;
    const defaultMax = 6;
    const normalizedUtilizationBeyondThreshold =
      (weeklyUtilization - threshold) / (100 - threshold);
    const expectedMax = Math.floor(
      defaultMax * Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
    );
    expect(mockProjectRepository.getByUrl).toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(
      expectedMax,
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(
      expectedMax,
    );
  });

  it('should skip all preparation when weekly window usage reduces maximumPreparingIssuesCount to 0', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 100, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should not apply weekly reduction when threshold is 100', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 99, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 100,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(6);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(6);
  });

  it('should still skip immediately when non-weekly window exceeds threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 95, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 50, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should use maximum utilization across multiple weekly window entries for reduction', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 168, utilizationPercentage: 91, resetsAt: new Date() },
      { hour: 168, utilizationPercentage: 95, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = Array.from({ length: 10 }, (_, i) =>
      createMockIssue({
        url: `url${i + 1}`,
        title: `Issue ${i + 1}`,
        labels: [],
        status: 'Awaiting Workspace',
      }),
    );
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    const normalizedUtilizationBeyondThreshold = (95 - 90) / (100 - 90);
    const expectedMax = Math.floor(
      6 * Math.pow(1 - normalizedUtilizationBeyondThreshold, 2),
    );
    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(
      expectedMax,
    );
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(
      expectedMax,
    );
  });

  it('should throw error when Claude usage check fails', async () => {
    mockClaudeRepository.getUsage.mockRejectedValue(
      new Error('Claude credentials file not found'),
    );

    await expect(
      useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: null,
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      }),
    ).rejects.toThrow('Claude credentials file not found');

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
  });

  it('should skip preparation when Claude usage exceeds custom threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 75, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: [],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 70,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(mockProjectRepository.getByUrl).not.toHaveBeenCalled();
  });

  it('should proceed with preparation when Claude usage is under custom threshold', async () => {
    mockClaudeRepository.getUsage.mockResolvedValue([
      { hour: 5, utilizationPercentage: 75, resetsAt: new Date() },
    ]);

    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 80,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should skip issues that have dependedIssueUrls', async () => {
    const issueWithDependency = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue with dependency',
      labels: [],
      status: 'Awaiting Workspace',
      dependedIssueUrls: ['https://github.com/user/repo/issues/2'],
    });
    const issueWithoutDependency = createMockIssue({
      url: 'https://github.com/user/repo/issues/3',
      title: 'Issue without dependency',
      labels: [],
      status: 'Awaiting Workspace',
      dependedIssueUrls: [],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([issueWithDependency, issueWithoutDependency]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'https://github.com/user/repo/issues/3',
      status: 'Preparation',
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should skip issues where nextActionHour is in the future', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-01T10:00:00'));

      const issueWithFutureNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with future next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: 15,
      });
      const issueWithoutNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        title: 'Issue without next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([
          issueWithFutureNextActionHour,
          issueWithoutNextActionHour,
        ]),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: 'claude-sonnet-4-6',
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
        url: 'https://github.com/user/repo/issues/2',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should skip issues where nextActionDate is tomorrow or more future', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithFutureNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with future next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-16'),
      });
      const issueWithoutNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/2',
        title: 'Issue without next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: null,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([
          issueWithFutureNextActionDate,
          issueWithoutNextActionDate,
        ]),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: 'claude-sonnet-4-6',
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
        url: 'https://github.com/user/repo/issues/2',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionDate is today', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithTodayNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with today next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-15'),
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithTodayNextActionDate]),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: 'claude-sonnet-4-6',
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionDate is in the past', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-15T10:00:00'));

      const issueWithPastNextActionDate = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with past next action date',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionDate: new Date('2024-01-14'),
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithPastNextActionDate]),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: 'claude-sonnet-4-6',
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should not skip issues where nextActionHour is in the past or current hour', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2024-01-01T15:00:00'));

      const issueWithPastNextActionHour = createMockIssue({
        url: 'https://github.com/user/repo/issues/1',
        title: 'Issue with past next action hour',
        labels: [],
        status: 'Awaiting Workspace',
        nextActionHour: 10,
      });

      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.getStoryObjectMap.mockResolvedValue(
        createMockStoryObjectMap([issueWithPastNextActionHour]),
      );
      mockLocalCommandRunner.runCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await useCase.run({
        projectUrl: 'https://github.com/user/repo',
        defaultAgentName: 'agent1',
        defaultLlmModelName: 'claude-sonnet-4-6',
        defaultLlmAgentName: null,
        configFilePath: '/path/to/config.yml',
        maximumPreparingIssuesCount: null,
        utilizationPercentageThreshold: 90,
        allowedIssueAuthors: null,
        codexHomeCandidates: null,
        allowIssueCacheMinutes: 0,
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
        url: 'https://github.com/user/repo/issues/1',
        status: 'Preparation',
      });
      expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should skip issues from non-allowed authors', async () => {
    const issueFromAllowedAuthor = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue from allowed author',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });
    const issueFromNonAllowedAuthor = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Issue from non-allowed author',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user3',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([
        issueFromAllowedAuthor,
        issueFromNonAllowedAuthor,
      ]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1', 'user2'],
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'https://github.com/user/repo/issues/1',
      status: 'Preparation',
    });
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should process all issues when allowedIssueAuthors is null', async () => {
    const issue1 = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue 1',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });
    const issue2 = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Issue 2',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user2',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([issue1, issue2]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(2);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });

  it('should not skip issues with empty author (tower defence issues)', async () => {
    const towerDefenceIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Tower defence issue',
      labels: [],
      status: 'Awaiting Workspace',
      author: '',
    });
    const normalIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      title: 'Normal issue',
      labels: [],
      status: 'Awaiting Workspace',
      author: 'user1',
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([towerDefenceIssue, normalIssue]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1', 'user2'],
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(2);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(2);
  });

  it('should not skip issues without author property when allowedIssueAuthors is set', async () => {
    const issueWithoutAuthor = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Issue without author property',
      labels: [],
      status: 'Awaiting Workspace',
      author: '',
    });

    const storyObjectMap: StoryObjectMap = new Map();
    storyObjectMap.set('Default Story', {
      story: {
        id: 'story-1',
        name: 'Default Story',
        color: 'GRAY',
        description: '',
      },
      storyIssue: null,
      issues: [issueWithoutAuthor],
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(storyObjectMap);
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: ['user1'],
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
  });

  it('should not pass --codexHome when codexHomeCandidates is null', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });

  it('should not pass --codexHome when codexHomeCandidates is empty array', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: [],
      allowIssueCacheMinutes: 0,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
      ],
    ]);
  });

  it('should pass --codexHome with the candidate when codexHomeCandidates has one entry', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: ['.codex-dev1'],
      allowIssueCacheMinutes: 0,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(1);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0]).toEqual([
      'aw',
      [
        'url1',
        'impl',
        'claude-opus',
        '--configFilePath',
        '/path/to/config.yml',
        '--branch',
        'i1',
        '--codexHome',
        '.codex-dev1',
      ],
    ]);
  });

  it('should cycle through codexHomeCandidates across multiple issues', async () => {
    const awaitingIssues: Issue[] = [
      createMockIssue({
        url: 'url1',
        title: 'Issue 1',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
        number: 1,
        itemId: 'item-1',
      }),
      createMockIssue({
        url: 'url2',
        title: 'Issue 2',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
        number: 2,
        itemId: 'item-2',
      }),
      createMockIssue({
        url: 'url3',
        title: 'Issue 3',
        labels: ['category:impl'],
        status: 'Awaiting Workspace',
        number: 3,
        itemId: 'item-3',
      }),
    ];
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap(awaitingIssues),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: ['.codex-dev1', '.codex-dev2'],
      allowIssueCacheMinutes: 0,
    });

    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(3);
    expect(mockLocalCommandRunner.runCommand.mock.calls[0][1]).toContain(
      '--codexHome',
    );
    expect(
      mockLocalCommandRunner.runCommand.mock.calls[0][1][
        mockLocalCommandRunner.runCommand.mock.calls[0][1].indexOf(
          '--codexHome',
        ) + 1
      ],
    ).toBe('.codex-dev1');
    expect(mockLocalCommandRunner.runCommand.mock.calls[1][1]).toContain(
      '--codexHome',
    );
    expect(
      mockLocalCommandRunner.runCommand.mock.calls[1][1][
        mockLocalCommandRunner.runCommand.mock.calls[1][1].indexOf(
          '--codexHome',
        ) + 1
      ],
    ).toBe('.codex-dev2');
    expect(mockLocalCommandRunner.runCommand.mock.calls[2][1]).toContain(
      '--codexHome',
    );
    expect(
      mockLocalCommandRunner.runCommand.mock.calls[2][1][
        mockLocalCommandRunner.runCommand.mock.calls[2][1].indexOf(
          '--codexHome',
        ) + 1
      ],
    ).toBe('.codex-dev1');
  });

  it('should persist Preparation status via updateStatus with resolved status option id (regression for issue #519)', async () => {
    const awaitingIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/519',
      title: 'Regression issue',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
      itemId: 'item-regression',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([awaitingIssue]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][0]).toBe(mockProject);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'https://github.com/user/repo/issues/519',
      itemId: 'item-regression',
    });
    expect(mockIssueRepository.updateStatus.mock.calls[0][2]).toBe('2');
    const updateStatusCallOrder =
      mockIssueRepository.updateStatus.mock.invocationCallOrder[0];
    const runCommandCallOrder =
      mockLocalCommandRunner.runCommand.mock.invocationCallOrder[0];
    expect(updateStatusCallOrder).toBeLessThan(runCommandCallOrder);
  });

  it('should return early and log an error when preparationStatus option is not in the project', async () => {
    const projectWithoutPreparation: Project = {
      ...createMockProject(),
      status: {
        name: 'Status',
        fieldId: 'status-field-id',
        statuses: [
          {
            id: '1',
            name: 'Awaiting Workspace',
            color: 'GRAY',
            description: '',
          },
          { id: '3', name: 'Done', color: 'GREEN', description: '' },
        ],
      },
    };
    const awaitingIssue = createMockIssue({
      url: 'url-missing-option',
      title: 'Missing Preparation Option',
      labels: ['category:impl'],
      status: 'Awaiting Workspace',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(projectWithoutPreparation);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([awaitingIssue]),
    );
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-opus',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);
    expect(mockLocalCommandRunner.runCommand.mock.calls).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Preparation status option 'Preparation' not found in project.",
    );
    consoleErrorSpy.mockRestore();
  });

  it('should pass allowIssueCacheMinutes to getStoryObjectMap', async () => {
    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([]),
    );

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: null,
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 5,
    });

    expect(mockIssueRepository.getStoryObjectMap).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      5,
    );
  });

  it('should skip closed issues in awaiting workspace status', async () => {
    const closedIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/1',
      title: 'Closed issue',
      labels: [],
      status: 'Awaiting Workspace',
      isClosed: true,
    });
    const openIssue = createMockIssue({
      url: 'https://github.com/user/repo/issues/2',
      number: 2,
      title: 'Open issue',
      labels: [],
      status: 'Awaiting Workspace',
      isClosed: false,
    });

    mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
    mockIssueRepository.getStoryObjectMap.mockResolvedValue(
      createMockStoryObjectMap([closedIssue, openIssue]),
    );
    mockLocalCommandRunner.runCommand.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    await useCase.run({
      projectUrl: 'https://github.com/user/repo',
      defaultAgentName: 'agent1',
      defaultLlmModelName: 'claude-sonnet-4-6',
      defaultLlmAgentName: null,
      configFilePath: '/path/to/config.yml',
      maximumPreparingIssuesCount: null,
      utilizationPercentageThreshold: 90,
      allowedIssueAuthors: null,
      codexHomeCandidates: null,
      allowIssueCacheMinutes: 0,
    });

    expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    expect(mockIssueRepository.updateStatus.mock.calls[0][1]).toMatchObject({
      url: 'https://github.com/user/repo/issues/2',
    });
  });
});
