import { AgentDesignationLabelAdoptUseCase } from './AgentDesignationLabelAdoptUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test issue',
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
  itemId: 'item1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: 'author',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const createProject = (
  agentOptions: { id: string; name: string }[] = [],
): Project => ({
  id: 'project1',
  url: 'https://github.com/orgs/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: { name: 'Status', fieldId: 'field1', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent:
    agentOptions.length > 0
      ? {
          name: 'Agent',
          fieldId: 'agent-field',
          options: agentOptions.map((o) => ({
            id: o.id,
            name: o.name,
            color: 'GRAY' as const,
            description: '',
          })),
        }
      : null,
});

describe('AgentDesignationLabelAdoptUseCase', () => {
  let mockProjectRepository: {
    getByUrl: jest.Mock;
    createField: jest.Mock;
    updateAgentList: jest.Mock;
  };
  let mockIssueRepository: {
    setIssueAgentField: jest.Mock;
    removeLabel: jest.Mock;
  };
  let useCase: AgentDesignationLabelAdoptUseCase;

  beforeEach(() => {
    jest.resetAllMocks();
    mockProjectRepository = {
      getByUrl: jest.fn(),
      createField: jest.fn().mockResolvedValue(undefined),
      updateAgentList: jest.fn().mockResolvedValue([]),
    };
    mockIssueRepository = {
      setIssueAgentField: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new AgentDesignationLabelAdoptUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
  });

  it('should set the Agent field and remove the label for an open non-spawn-candidate item carrying a label matching a configured agent name', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['chore'],
      agent: null,
      status: 'Preparation',
      dependedIssueUrls: ['https://github.com/user/repo/issues/99'],
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore', 'accounting'],
    });

    expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
      issue.url,
      project,
      'option-chore-id',
    );
    expect(mockIssueRepository.removeLabel).toHaveBeenCalledWith(
      issue,
      'chore',
    );
    expect(issue.agent).toBe('chore');
    expect(issue.labels).not.toContain('chore');
  });

  it('should not modify an item with no label matching any configured agent name', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['bug', 'feature'],
      agent: null,
    });

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore'],
    });

    expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    expect(issue.agent).toBeNull();
    expect(issue.labels).toEqual(['bug', 'feature']);
  });

  it('should not modify an item whose Agent field already matches the designation label', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['chore'],
      agent: 'chore',
    });

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore'],
    });

    expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
  });

  it('should override the Agent field and remove the label when the designation label differs from the current Agent field', async () => {
    const project = createProject([
      { id: 'option-chore-id', name: 'chore' },
      { id: 'option-developer-id', name: 'developer' },
    ]);
    const issue = createIssue({
      labels: ['chore'],
      agent: 'developer',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore', 'developer'],
    });

    expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
      issue.url,
      project,
      'option-chore-id',
    );
    expect(mockIssueRepository.removeLabel).toHaveBeenCalledWith(
      issue,
      'chore',
    );
    expect(issue.agent).toBe('chore');
    expect(issue.labels).not.toContain('chore');
  });

  it('should override the Agent field and keep the label when the designation label differs from the current Agent field and is in agentDesignationLabelsToKeep', async () => {
    const project = createProject([
      { id: 'option-story-id', name: 'story' },
      { id: 'option-developer-id', name: 'developer' },
    ]);
    const issue = createIssue({
      labels: ['story'],
      agent: 'developer',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issue],
      agents: ['story', 'developer'],
      agentDesignationLabelsToKeep: ['story'],
    });

    expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
      issue.url,
      project,
      'option-story-id',
    );
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    expect(issue.agent).toBe('story');
    expect(issue.labels).toContain('story');
  });

  it('should skip closed items', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['chore'],
      agent: null,
      isClosed: true,
    });

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore'],
    });

    expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
  });

  it('should do nothing when agents is null', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['chore'],
      agent: null,
    });

    await useCase.run({
      project,
      issues: [issue],
      agents: null,
    });

    expect(mockIssueRepository.setIssueAgentField).not.toHaveBeenCalled();
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
  });

  it('should set the Agent field but keep the label when the label is in agentDesignationLabelsToKeep', async () => {
    const project = createProject([{ id: 'option-story-id', name: 'story' }]);
    const issue = createIssue({
      labels: ['story'],
      agent: null,
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issue],
      agents: ['story'],
      agentDesignationLabelsToKeep: ['story'],
    });

    expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledWith(
      issue.url,
      project,
      'option-story-id',
    );
    expect(mockIssueRepository.removeLabel).not.toHaveBeenCalled();
    expect(issue.agent).toBe('story');
    expect(issue.labels).toContain('story');
  });

  it('should remove the label when it is not in agentDesignationLabelsToKeep', async () => {
    const project = createProject([{ id: 'option-chore-id', name: 'chore' }]);
    const issue = createIssue({
      labels: ['chore'],
      agent: null,
      status: 'Preparation',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issue],
      agents: ['chore'],
      agentDesignationLabelsToKeep: ['story'],
    });

    expect(mockIssueRepository.removeLabel).toHaveBeenCalledWith(
      issue,
      'chore',
    );
    expect(issue.agent).toBe('chore');
    expect(issue.labels).not.toContain('chore');
  });

  it('should process all items in the list and adopt each matching label', async () => {
    const project = createProject([
      { id: 'option-chore-id', name: 'chore' },
      { id: 'option-accounting-id', name: 'accounting' },
    ]);
    const issueChore = createIssue({
      url: 'https://github.com/user/repo/issues/1',
      labels: ['chore'],
      agent: null,
      status: 'In Review',
    });
    const issueAccounting = createIssue({
      url: 'https://github.com/user/repo/issues/2',
      labels: ['accounting'],
      agent: null,
      status: 'Awaiting Workspace',
    });
    mockProjectRepository.getByUrl.mockResolvedValue(project);

    await useCase.run({
      project,
      issues: [issueChore, issueAccounting],
      agents: ['chore', 'accounting'],
    });

    expect(mockIssueRepository.setIssueAgentField).toHaveBeenCalledTimes(2);
    expect(issueChore.agent).toBe('chore');
    expect(issueAccounting.agent).toBe('accounting');
  });
});
