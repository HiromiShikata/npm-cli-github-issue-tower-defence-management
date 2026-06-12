import { CheckIssueReviewReadinessUseCase } from './CheckIssueReviewReadinessUseCase';
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
  createdAt: new Date('2000-01-01T00:00:00Z'),
  author: 'test-user',
  ...overrides,
});

const createReadyPr = (
  overrides: Partial<RelatedPullRequest> = {},
): RelatedPullRequest => ({
  url: 'https://github.com/user/repo/pull/1',
  branchName: 'feature-branch',
  createdAt: new Date('2000-01-01T00:00:00Z'),
  isDraft: false,
  isConflicted: false,
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isResolvedAllReviewComments: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
  ...overrides,
});

describe('CheckIssueReviewReadinessUseCase', () => {
  let mockProjectRepository: { getByUrl: jest.Mock };
  let mockIssueRepository: {
    get: jest.Mock;
    findRelatedOpenPRs: jest.Mock;
    getOpenPullRequest: jest.Mock;
    getPullRequestChangedFilePaths: jest.Mock;
    requestChangesWithInlineComment: jest.Mock;
  };
  let useCase: CheckIssueReviewReadinessUseCase;
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();

    mockProject = createMockProject();

    mockProjectRepository = {
      getByUrl: jest.fn(),
    };

    mockIssueRepository = {
      get: jest.fn(),
      findRelatedOpenPRs: jest.fn(),
      getOpenPullRequest: jest.fn(),
      getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
      requestChangesWithInlineComment: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CheckIssueReviewReadinessUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
  });

  describe('run', () => {
    it('should return reviewReady=true with empty rejections when the linked PR is ready', async () => {
      const issue = createMockIssue();
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr(),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(true);
      expect(result.rejections).toEqual([]);
    });

    it('should return reviewReady=false with rejections when the linked PR has failing CI', async () => {
      const issue = createMockIssue();
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([
        createReadyPr({
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
        }),
      ]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toHaveLength(1);
      expect(result.rejections[0].type).toBe(
        'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
      );
      expect(result.rejections[0].detail).toContain(
        'https://github.com/user/repo/pull/1',
      );
    });

    it('should return reviewReady=false with PULL_REQUEST_NOT_FOUND when no related PR exists', async () => {
      const issue = createMockIssue();
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);
      mockIssueRepository.findRelatedOpenPRs.mockResolvedValue([]);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(result.reviewReady).toBe(false);
      expect(result.rejections).toEqual([
        { type: 'PULL_REQUEST_NOT_FOUND', detail: 'PULL_REQUEST_NOT_FOUND' },
      ]);
    });

    it('should throw IssueNotFoundError when the issue does not exist', async () => {
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(null);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          issueUrl: 'https://github.com/user/repo/issues/999',
        }),
      ).rejects.toThrow(
        'Issue not found: https://github.com/user/repo/issues/999',
      );
    });

    it('should not call findRelatedOpenPRs nor mutate state when issue has a category label other than e2e', async () => {
      const issue = createMockIssue({ labels: ['category:frontend'] });
      mockProjectRepository.getByUrl.mockResolvedValue(mockProject);
      mockIssueRepository.get.mockResolvedValue(issue);

      const result = await useCase.run({
        projectUrl: 'https://github.com/users/user/projects/1',
        issueUrl: 'https://github.com/user/repo/issues/1',
      });

      expect(mockIssueRepository.findRelatedOpenPRs).not.toHaveBeenCalled();
      expect(result.reviewReady).toBe(true);
      expect(result.rejections).toEqual([]);
    });
  });
});
