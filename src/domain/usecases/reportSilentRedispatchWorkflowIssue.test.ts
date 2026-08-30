import { reportSilentRedispatchWorkflowIssue } from './reportSilentRedispatchWorkflowIssue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

type MockIssueRepository = jest.Mocked<
  Pick<
    IssueRepository,
    | 'searchIssue'
    | 'createNewIssue'
    | 'createCommentByUrl'
    | 'addIssueToProject'
    | 'getIssueByUrl'
    | 'updateStory'
  >
>;

type MockProjectRepository = jest.Mocked<Pick<ProjectRepository, 'getByUrl'>>;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'owner/repo',
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
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: 'test-author',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  url: 'https://github.com/orgs/owner/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [
      { id: '1', name: 'Awaiting Workspace', color: 'GRAY', description: '' },
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

describe('reportSilentRedispatchWorkflowIssue', () => {
  let mockIssueRepository: MockIssueRepository;
  let mockProjectRepository: MockProjectRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    mockIssueRepository = {
      searchIssue: jest.fn().mockResolvedValue([]),
      createNewIssue: jest.fn().mockResolvedValue(99),
      createCommentByUrl: jest.fn().mockResolvedValue(undefined),
      addIssueToProject: jest.fn().mockResolvedValue(undefined),
      getIssueByUrl: jest.fn().mockResolvedValue(null),
      updateStory: jest.fn().mockResolvedValue(undefined),
    };
    mockProjectRepository = {
      getByUrl: jest.fn().mockResolvedValue(createMockProject()),
    };
  });

  it('creates a new issue when no existing open issue with that title is found', async () => {
    mockIssueRepository.searchIssue.mockResolvedValue([]);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      { owner: 'wf-owner', repo: 'wf-repo' },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.searchIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'wf-owner',
        repositoryName: 'wf-repo',
        title: 'TDPM agent not reporting: accounting',
        state: 'open',
      }),
    );
    expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
      'wf-owner',
      'wf-repo',
      'TDPM agent not reporting: accounting',
      expect.stringContaining('accounting'),
      [],
      [],
    );
    expect(mockIssueRepository.createCommentByUrl).not.toHaveBeenCalled();
  });

  it('comments on the existing issue when an open issue with the same title exists', async () => {
    mockIssueRepository.searchIssue.mockResolvedValue([
      {
        url: 'https://github.com/wf-owner/wf-repo/issues/5',
        title: 'TDPM agent not reporting: accounting',
        number: '5',
      },
    ]);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      { owner: 'wf-owner', repo: 'wf-repo' },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    expect(mockIssueRepository.createCommentByUrl).toHaveBeenCalledWith(
      'https://github.com/wf-owner/wf-repo/issues/5',
      expect.stringContaining('accounting'),
    );
  });

  it('adds the new issue to the project and sets workflow blocker story when projectUrl is set', async () => {
    const createdIssue = createMockIssue({
      url: 'https://github.com/wf-owner/wf-repo/issues/99',
    });
    const reporterProject = createMockProject({
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 10,
        stories: [
          {
            id: 'workflow-blocker-id',
            name: 'regular / workflow blocker',
            color: 'RED',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wm-id', name: 'workflow management' },
      },
    });

    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(createdIssue);
    mockProjectRepository.getByUrl.mockResolvedValue(reporterProject);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      {
        owner: 'wf-owner',
        repo: 'wf-repo',
        projectUrl: 'https://github.com/orgs/wf-owner/projects/5',
      },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockProjectRepository.getByUrl).toHaveBeenCalledWith(
      'https://github.com/orgs/wf-owner/projects/5',
    );
    expect(mockIssueRepository.addIssueToProject).toHaveBeenCalledWith(
      reporterProject,
      'https://github.com/wf-owner/wf-repo/issues/99',
    );
    expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
      { ...reporterProject, story: reporterProject.story },
      createdIssue,
      'workflow-blocker-id',
    );
  });

  it('does NOT call addIssueToProject when projectUrl is not set', async () => {
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      { owner: 'wf-owner', repo: 'wf-repo' },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.addIssueToProject).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
  });

  it('does NOT call addIssueToProject when projectUrl is null', async () => {
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      { owner: 'wf-owner', repo: 'wf-repo', projectUrl: null },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.addIssueToProject).not.toHaveBeenCalled();
  });

  it('skips story assignment when the project has no story field', async () => {
    const reporterProject = createMockProject({ story: null });
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);
    mockProjectRepository.getByUrl.mockResolvedValue(reporterProject);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      {
        owner: 'wf-owner',
        repo: 'wf-repo',
        projectUrl: 'https://github.com/orgs/wf-owner/projects/5',
      },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.addIssueToProject).toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
  });

  it('skips story assignment when the project has no workflow blocker story option', async () => {
    const reporterProject = createMockProject({
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 10,
        stories: [
          { id: 'other-id', name: 'regular', color: 'GRAY', description: '' },
        ],
        workflowManagementStory: { id: 'wm-id', name: 'workflow management' },
      },
    });
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);
    mockProjectRepository.getByUrl.mockResolvedValue(reporterProject);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      {
        owner: 'wf-owner',
        repo: 'wf-repo',
        projectUrl: 'https://github.com/orgs/wf-owner/projects/5',
      },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.addIssueToProject).toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
  });

  it('skips story assignment when getIssueByUrl returns null', async () => {
    const reporterProject = createMockProject({
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 10,
        stories: [
          {
            id: 'wb-id',
            name: 'workflow blocker',
            color: 'RED',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wm-id', name: 'workflow management' },
      },
    });
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);
    mockIssueRepository.getIssueByUrl.mockResolvedValue(null);
    mockProjectRepository.getByUrl.mockResolvedValue(reporterProject);

    await reportSilentRedispatchWorkflowIssue(
      'accounting',
      'https://github.com/user/repo/issues/1',
      {
        owner: 'wf-owner',
        repo: 'wf-repo',
        projectUrl: 'https://github.com/orgs/wf-owner/projects/5',
      },
      mockIssueRepository,
      mockProjectRepository,
    );

    expect(mockIssueRepository.addIssueToProject).toHaveBeenCalled();
    expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
  });

  it('does not throw when project assignment fails; logs a warning instead', async () => {
    mockIssueRepository.searchIssue.mockResolvedValue([]);
    mockIssueRepository.createNewIssue.mockResolvedValue(99);
    mockProjectRepository.getByUrl.mockRejectedValue(new Error('API error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      reportSilentRedispatchWorkflowIssue(
        'accounting',
        'https://github.com/user/repo/issues/1',
        {
          owner: 'wf-owner',
          repo: 'wf-repo',
          projectUrl: 'https://github.com/orgs/wf-owner/projects/5',
        },
        mockIssueRepository,
        mockProjectRepository,
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to add workflow issue'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('does not throw when issue search fails; logs a warning instead', async () => {
    mockIssueRepository.searchIssue.mockRejectedValue(
      new Error('network error'),
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      reportSilentRedispatchWorkflowIssue(
        'accounting',
        'https://github.com/user/repo/issues/1',
        { owner: 'wf-owner', repo: 'wf-repo' },
        mockIssueRepository,
        mockProjectRepository,
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to report silent redispatch workflow issue',
      ),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
