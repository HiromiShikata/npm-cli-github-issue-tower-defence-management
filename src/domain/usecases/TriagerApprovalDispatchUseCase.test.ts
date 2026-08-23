import { TriagerApprovalDispatchUseCase } from './TriagerApprovalDispatchUseCase';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Comment } from '../entities/Comment';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

type MockedProjectRepository = jest.Mocked<
  Pick<
    ProjectRepository,
    | 'findProjectIdByUrl'
    | 'getProject'
    | 'createField'
    | 'getByUrl'
    | 'updateAgentList'
  >
>;
type MockedIssueRepository = jest.Mocked<
  Pick<
    IssueRepository,
    'getAllIssues' | 'updateStatus' | 'updateStory' | 'setIssueAgentField'
  >
>;
type MockedIssueCommentRepository = jest.Mocked<
  Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>
>;

const TRIAGER_PROPOSAL_COMMENT = (
  agent: string,
  story: string,
  storyAlreadySet: boolean,
): string =>
  `From: :robot: triager (claude-sonnet-4-6)\n\`\`\`json\n{ "pullRequestRequired": false, "nextStep": null }\n\`\`\`\n\n## Proposal\n\n\`\`\`json\n${JSON.stringify({ triagerProposal: { recommendedAgent: agent, recommendedStory: story, storyAlreadySet } })}\n\`\`\``;

const createComment = (
  author: string,
  content: string,
  createdAt = new Date('2000-01-01T00:00:00Z'),
): Comment => ({ author, content, createdAt });

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Awaiting Quality Check',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/owner/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'owner',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2000-01-01T00:00:00Z'),
  author: 'owner-user',
  closingIssueReferenceUrls: [],
  agent: null,
  ...overrides,
});

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: 'https://github.com/orgs/owner/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      {
        id: 'awaiting-workspace-id',
        name: 'Awaiting Workspace',
        color: 'BLUE',
        description: '',
      },
      {
        id: 'awaiting-quality-check-id',
        name: 'Awaiting Quality Check',
        color: 'GREEN',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'Story',
    fieldId: 'story-field-id',
    databaseId: 2,
    stories: [
      {
        id: 'story-regular-workflow-id',
        name: 'regular / workflow improvement',
        color: 'GRAY',
        description: '',
      },
    ],
    workflowManagementStory: {
      id: 'wf-story-id',
      name: 'workflow management',
    },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: {
    name: 'Agent',
    fieldId: 'agent-field-id',
    options: [
      {
        id: 'developer-option-id',
        name: 'developer',
        color: 'GRAY',
        description: '',
      },
    ],
  },
  ...overrides,
});

describe('TriagerApprovalDispatchUseCase', () => {
  let useCase: TriagerApprovalDispatchUseCase;
  let mockProjectRepository: MockedProjectRepository;
  let mockIssueRepository: MockedIssueRepository;
  let mockIssueCommentRepository: MockedIssueCommentRepository;
  let mockProject: Project;

  beforeEach(() => {
    jest.resetAllMocks();
    mockProject = createMockProject();
    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn().mockResolvedValue(mockProject),
      createField: jest.fn().mockResolvedValue(undefined),
      getByUrl: jest.fn().mockResolvedValue(mockProject),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    mockIssueRepository = {
      getAllIssues: jest.fn().mockResolvedValue({
        project: mockProject,
        issues: [],
        cacheUsed: false,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateStory: jest.fn().mockResolvedValue(undefined),
      setIssueAgentField: jest.fn().mockResolvedValue(undefined),
    };
    mockIssueCommentRepository = {
      getCommentsFromIssue: jest.fn().mockResolvedValue([]),
      createComment: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new TriagerApprovalDispatchUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockIssueCommentRepository,
    );
  });

  describe('run', () => {
    it('should do nothing when no issues are in candidate statuses', async () => {
      const irrelevantIssue = createMockIssue({
        status: 'Preparation',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [irrelevantIssue],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(
        mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
      ).toEqual([]);
      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
    });

    it('should do nothing when the triager proposal comment has no machine-readable block', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          'From: :robot: triager (claude-sonnet-4-6)\n```json\n{ "pullRequestRequired": false, "nextStep": null }\n```\n\nRecommended agent: `developer`\nRecommended story: regular / workflow improvement',
        ),
        createComment('owner-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
    });

    it('should do nothing when there is a proposal but no approval comment', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
    });

    it('should do nothing when the approval comment is posted before the proposal', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment('owner-user', 'ok'),
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
    });

    it('should skip the story update when the proposal reports storyAlreadySet true', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
        story: 'regular / workflow improvement',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            true,
          ),
        ),
        createComment('owner-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([
        [
          'https://github.com/owner/repo/issues/1',
          mockProject,
          'developer-option-id',
        ],
      ]);
      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
        [mockProject, issue, 'awaiting-workspace-id'],
      ]);
      expect(mockIssueCommentRepository.createComment.mock.calls).toHaveLength(
        1,
      );
    });

    it('should skip the issue when the recommended agent name cannot be resolved', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'unknown-agent-xyz',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'ok'),
      ]);
      mockProjectRepository.updateAgentList.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
      expect(mockIssueCommentRepository.createComment.mock.calls).toEqual([]);
    });

    it('should not treat a comment from an author not in the allowed list as an approval', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('external-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([]);
    });

    it('should set story, agent, and status to Awaiting Workspace on approval', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([
        [mockProject, issue, 'story-regular-workflow-id'],
      ]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toEqual([
        [
          'https://github.com/owner/repo/issues/1',
          mockProject,
          'developer-option-id',
        ],
      ]);
      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
        [mockProject, issue, 'awaiting-workspace-id'],
      ]);
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('TRIAGER_PROPOSAL_APPROVED'),
      );
    });

    it('should accept OK (uppercase) as an approval token', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Workspace',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'OK'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    });

    it('should accept オーケー as an approval token', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'オーケー'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    });

    it('should not treat a long comment containing ok as an approval', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment(
          'owner-user',
          'Looks ok but I have some concerns about the story choice.',
        ),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
    });

    it('should not treat an agent report comment starting with From: :robot: as an approval', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'From: :robot: ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([]);
    });

    it('should skip issues where the agent field is already set', async () => {
      const issueWithAgent = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
        agent: 'developer',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issueWithAgent],
        cacheUsed: false,
      });

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(
        mockIssueCommentRepository.getCommentsFromIssue.mock.calls,
      ).toEqual([]);
    });

    it('should fetch comments for at most 20 candidate issues per cycle when the backlog is large', async () => {
      const manyIssues = Array.from({ length: 25 }, (_, i) =>
        createMockIssue({
          number: i + 1,
          url: `https://github.com/owner/repo/issues/${i + 1}`,
          itemId: `item-${i + 1}`,
          status: 'Awaiting Quality Check',
          author: 'owner-user',
        }),
      );
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: manyIssues,
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(
        mockIssueCommentRepository.getCommentsFromIssue,
      ).toHaveBeenCalledTimes(20);
    });

    it('should dispatch an approval on a candidate beyond position 20 when the cycle index advances to the next window', async () => {
      const candidates = Array.from({ length: 21 }, (_, i) =>
        createMockIssue({
          number: i + 1,
          url: `https://github.com/owner/repo/issues/${i + 1}`,
          itemId: `item-${i + 1}`,
          status: 'Awaiting Quality Check',
          author: 'owner-user',
          createdAt: new Date(2000 + i, 0, 1),
        }),
      );
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: candidates,
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockImplementation(
        async (issue) => {
          if (issue.number === 21) {
            return [
              createComment(
                'bot',
                TRIAGER_PROPOSAL_COMMENT(
                  'developer',
                  'regular / workflow improvement',
                  false,
                ),
              ),
              createComment('owner-user', 'ok'),
            ];
          }
          return [];
        },
      );

      // cycleIndex=0: windowStart=0, covers positions 0-19 (issues 1-20); issue 21 not reached
      const firstUseCase = new TriagerApprovalDispatchUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
      );
      await firstUseCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
        cycleIndex: 0,
      });
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(0);

      // cycleIndex=1: windowStart=20, covers position 20 (issue 21)
      const secondUseCase = new TriagerApprovalDispatchUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
      );
      await secondUseCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
        cycleIndex: 1,
      });

      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/21',
        mockProject,
        'developer-option-id',
      );
      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    });

    it('should include issues where the agent field is already set to triager in the candidate list', async () => {
      const issueWithTriagerAgent = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
        agent: 'triager',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issueWithTriagerAgent],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
      expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
        'https://github.com/owner/repo/issues/1',
        mockProject,
        'developer-option-id',
      );
    });

    it('should accept はい followed by natural language as an approval token', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'はい、それで良いです。進めてください'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toHaveLength(1);
    });

    it('should read all candidates across consecutive cycles even when candidate count evenly divides MAX_COMMENT_FETCHES_PER_CYCLE', async () => {
      const candidates = Array.from({ length: 40 }, (_, i) =>
        createMockIssue({
          number: i + 1,
          url: `https://github.com/owner/repo/issues/${i + 1}`,
          itemId: `item-${i + 1}`,
          status: 'Awaiting Quality Check',
          author: 'owner-user',
          createdAt: new Date(2000 + i, 0, 1),
        }),
      );
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: candidates,
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([]);

      // cycleIndex=0: windowStart=0, covers positions 0-19 (issues 1-20)
      const firstUseCase = new TriagerApprovalDispatchUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
      );
      await firstUseCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
        cycleIndex: 0,
      });

      // cycleIndex=1: windowStart=20, covers positions 20-39 (issues 21-40)
      const secondUseCase = new TriagerApprovalDispatchUseCase(
        mockProjectRepository,
        mockIssueRepository,
        mockIssueCommentRepository,
      );
      await secondUseCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
        cycleIndex: 1,
      });

      expect(
        mockIssueCommentRepository.getCommentsFromIssue,
      ).toHaveBeenCalledTimes(40);
      const fetchedNumbers =
        mockIssueCommentRepository.getCommentsFromIssue.mock.calls.map(
          ([issue]) => issue.number,
        );
      for (let i = 1; i <= 40; i++) {
        expect(fetchedNumbers).toContain(i);
      }
    });

    it('should dispatch using the last proposal when the owner approved after the first of multiple proposals', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      // p1 (storyAlreadySet=false) → owner ok → p2 (storyAlreadySet=true)
      // The ok after p1 satisfies the approval gate (firstProposalIndex=0);
      // the last proposal (p2, storyAlreadySet=true) is used for recommendation.
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment('owner-user', 'ok'),
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            true,
          ),
        ),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(1);
      expect(mockIssueCommentRepository.createComment).toHaveBeenCalledWith(
        issue,
        expect.stringContaining('TRIAGER_PROPOSAL_APPROVED'),
      );
    });

    it('should use the last triager proposal when multiple proposals exist', async () => {
      const issue = createMockIssue({
        status: 'Awaiting Quality Check',
        author: 'owner-user',
      });
      mockIssueRepository.getAllIssues.mockResolvedValue({
        project: mockProject,
        issues: [issue],
        cacheUsed: false,
      });
      mockIssueCommentRepository.getCommentsFromIssue.mockResolvedValue([
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            false,
          ),
        ),
        createComment(
          'bot',
          TRIAGER_PROPOSAL_COMMENT(
            'developer',
            'regular / workflow improvement',
            true,
          ),
        ),
        createComment('owner-user', 'ok'),
      ]);

      await useCase.run({
        projectUrl: 'https://github.com/orgs/owner/projects/1',
        allowedIssueAuthors: ['owner-user'],
      });

      expect(mockIssueRepository.updateStory.mock.calls).toEqual([]);
      expect(mockIssueRepository.setIssueAgentField.mock.calls).toHaveLength(1);
    });
  });
});
