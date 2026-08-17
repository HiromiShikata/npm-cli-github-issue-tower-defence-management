import { RevertOrphanedInTmuxByAgentIssueUseCase } from './RevertOrphanedInTmuxByAgentIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { AgentHeartbeatRepository } from './adapter-interfaces/AgentHeartbeatRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';
import { IN_TMUX_BY_AGENT_STATUS_NAME } from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const AWAITING_WORKSPACE_STATUS_ID = 'status-awaiting-workspace';
const IN_TMUX_BY_AGENT_STATUS_ID = 'status-in-tmux-by-agent';

const NOW = new Date('2026-01-01T12:00:00Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
const MIN_ORPHAN_AGE_SECONDS = 300;

const STALE_ORPHAN_CANDIDATE = NOW_SECONDS - MIN_ORPHAN_AGE_SECONDS - 60;
const FRESH_ORPHAN_CANDIDATE = NOW_SECONDS - MIN_ORPHAN_AGE_SECONDS + 30;

const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: IN_TMUX_BY_AGENT_STATUS_NAME,
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
  author: 'bot',
  closingIssueReferenceUrls: [],
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
        id: AWAITING_WORKSPACE_STATUS_ID,
        name: 'Awaiting Workspace',
        color: 'BLUE',
        description: '',
      },
      {
        id: IN_TMUX_BY_AGENT_STATUS_ID,
        name: IN_TMUX_BY_AGENT_STATUS_NAME,
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
});

describe('RevertOrphanedInTmuxByAgentIssueUseCase', () => {
  let useCase: RevertOrphanedInTmuxByAgentIssueUseCase;
  let mockProjectRepository: Mocked<
    Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>
  >;
  let mockIssueRepository: Mocked<
    Pick<IssueRepository, 'getAllIssues' | 'updateStatus' | 'get'>
  >;
  let mockTmuxSessionRepository: Mocked<
    Pick<
      TmuxSessionRepository,
      'listLiveSessionNames' | 'listInteractiveProcessCommandLines'
    >
  >;
  let mockAgentHeartbeatRepository: Mocked<AgentHeartbeatRepository>;
  let mockProject: Project;

  beforeEach(() => {
    mockProject = createMockProject();
    mockProjectRepository = {
      findProjectIdByUrl: jest.fn().mockResolvedValue('project-1'),
      getProject: jest.fn().mockResolvedValue(mockProject),
    };
    mockIssueRepository = {
      getAllIssues: jest.fn().mockResolvedValue({
        issues: [],
        project: mockProject,
        cacheUsed: false,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    };
    mockTmuxSessionRepository = {
      listLiveSessionNames: jest.fn().mockResolvedValue([]),
      listInteractiveProcessCommandLines: jest.fn().mockResolvedValue([]),
    };
    mockAgentHeartbeatRepository = {
      readHeartbeatEpochSeconds: jest.fn().mockResolvedValue(null),
      writeHeartbeat: jest.fn().mockResolvedValue(undefined),
      readOrphanCandidateEpochSeconds: jest.fn().mockResolvedValue(null),
      writeOrphanCandidate: jest.fn().mockResolvedValue(undefined),
      deleteOrphanCandidate: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RevertOrphanedInTmuxByAgentIssueUseCase(
      mockProjectRepository,
      mockIssueRepository,
      mockTmuxSessionRepository,
      mockAgentHeartbeatRepository,
    );
  });

  const params = {
    projectUrl: 'https://github.com/orgs/user/projects/1',
    now: NOW,
    minOrphanAgeSeconds: MIN_ORPHAN_AGE_SECONDS,
  };

  // ── Core reclaim path ───────────────────────────────────────────────────────

  it('reverts an issue with no live tmux session and a stale orphan candidate', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/42',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockResolvedValue({
      ...issue,
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      AWAITING_WORKSPACE_STATUS_ID,
    );
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url);
  });

  // ── Grace period: first detection ───────────────────────────────────────────

  it('does not reclaim an issue first detected as a potential orphan (no previous orphan candidate record)', async () => {
    // This is the "moments ago" case: In Tmux by agent was just set, the sweep
    // has never previously noticed it as a potential orphan, so no orphan
    // candidate file exists. The current code without this fix would reclaim it
    // immediately; the fix writes an orphan candidate and skips.
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/100',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    // No orphan candidate on file — first time the sweep sees this issue.
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      null,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(
      mockAgentHeartbeatRepository.writeOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url, NOW_SECONDS);
  });

  it('does not reclaim an issue whose orphan candidate is within the grace period', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/101',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      FRESH_ORPHAN_CANDIDATE,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(
      mockAgentHeartbeatRepository.writeOrphanCandidate,
    ).not.toHaveBeenCalled();
  });

  // ── Named tmux session ───────────────────────────────────────────────────────

  it('does not revert an issue that has a live tmux session', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/99',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    const liveSessionName = toTmuxSessionName(issue.url);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      liveSessionName,
    ]);

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockAgentHeartbeatRepository.writeHeartbeat).toHaveBeenCalledWith(
      issue.url,
      NOW_SECONDS,
    );
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url);
  });

  it('does not revert an issue with a live named session even when its previous heartbeat is stale', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/99',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    const liveSessionName = toTmuxSessionName(issue.url);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      liveSessionName,
    ]);
    mockAgentHeartbeatRepository.readHeartbeatEpochSeconds.mockResolvedValue(
      NOW_SECONDS - MIN_ORPHAN_AGE_SECONDS - 600,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockAgentHeartbeatRepository.writeHeartbeat).toHaveBeenCalledWith(
      issue.url,
      NOW_SECONDS,
    );
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url);
  });

  // ── Process command-line detection ───────────────────────────────────────────

  it('does not revert an issue when its URL appears in a running process command line', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/301',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'tdpm-cli',
    ]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [`claude https://github.com/user/repo/issues/301`, 'bash -l'],
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(mockAgentHeartbeatRepository.writeHeartbeat).toHaveBeenCalledWith(
      issue.url,
      NOW_SECONDS,
    );
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url);
  });

  // ── Heartbeat as extra protection (workspace-leader agents that do write it) ─

  it('does not reclaim when the orphan candidate is stale but a fresh heartbeat exists', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/302',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'tdpm-cli',
    ]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );
    mockAgentHeartbeatRepository.readHeartbeatEpochSeconds.mockResolvedValue(
      NOW_SECONDS - MIN_ORPHAN_AGE_SECONDS + 30,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(issue.url);
  });

  it('reverts when the orphan candidate is stale and the heartbeat is also stale', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/303',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockResolvedValue({
      ...issue,
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'tdpm-cli',
    ]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );
    mockAgentHeartbeatRepository.readHeartbeatEpochSeconds.mockResolvedValue(
      NOW_SECONDS - MIN_ORPHAN_AGE_SECONDS - 60,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      AWAITING_WORKSPACE_STATUS_ID,
    );
  });

  it('reverts an issue worked from a workspace session that has an old orphan candidate and no heartbeat', async () => {
    // Workspace-leader session "tdpm-cli" is alive but is NOT named after the
    // issue URL and does not carry the URL in any process command line. After
    // minOrphanAgeSeconds have elapsed since the sweep first noticed the issue,
    // it is reclaimed.
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/300',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockResolvedValue({
      ...issue,
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      'tdpm-cli',
    ]);
    mockTmuxSessionRepository.listInteractiveProcessCommandLines.mockResolvedValue(
      [],
    );
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );
    mockAgentHeartbeatRepository.readHeartbeatEpochSeconds.mockResolvedValue(
      null,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      issue,
      AWAITING_WORKSPACE_STATUS_ID,
    );
  });

  // ── Mixed active and orphaned issues ─────────────────────────────────────────

  it('reverts only the orphaned issue when some issues have live sessions and others do not', async () => {
    const orphanedIssue = createMockIssue({
      number: 10,
      url: 'https://github.com/user/repo/issues/10',
      itemId: 'item-10',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    const activeIssue = createMockIssue({
      number: 20,
      url: 'https://github.com/user/repo/issues/20',
      itemId: 'item-20',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [orphanedIssue, activeIssue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockImplementation(async (url) => {
      if (url === orphanedIssue.url) {
        return { ...orphanedIssue, status: IN_TMUX_BY_AGENT_STATUS_NAME };
      }
      return null;
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      toTmuxSessionName(activeIssue.url),
    ]);
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds
      .mockResolvedValueOnce(STALE_ORPHAN_CANDIDATE) // orphanedIssue
      .mockResolvedValueOnce(null); // should not be reached for activeIssue

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).toHaveBeenCalledTimes(1);
    expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
      mockProject,
      orphanedIssue,
      AWAITING_WORKSPACE_STATUS_ID,
    );
    expect(mockAgentHeartbeatRepository.writeHeartbeat).toHaveBeenCalledWith(
      activeIssue.url,
      NOW_SECONDS,
    );
    expect(
      mockAgentHeartbeatRepository.deleteOrphanCandidate,
    ).toHaveBeenCalledWith(activeIssue.url);
  });

  // ── Status-change guard (live re-read) ───────────────────────────────────────

  it('does not revert an issue whose status is not In Tmux by agent', async () => {
    const issue = createMockIssue({
      status: 'Awaiting Workspace',
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('skips update when live re-read shows status has already changed', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/7',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockResolvedValue({
      ...issue,
      status: 'Awaiting Workspace',
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('skips update when get() throws while re-reading live status', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/5',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockRejectedValue(new Error('network error'));
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('skips update when get() returns null for the issue', async () => {
    const issue = createMockIssue({
      url: 'https://github.com/user/repo/issues/6',
      status: IN_TMUX_BY_AGENT_STATUS_NAME,
    });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: mockProject,
      cacheUsed: false,
    });
    mockIssueRepository.get.mockResolvedValue(null);
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);
    mockAgentHeartbeatRepository.readOrphanCandidateEpochSeconds.mockResolvedValue(
      STALE_ORPHAN_CANDIDATE,
    );

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  // ── Early-exit / configuration guards ────────────────────────────────────────

  it('does nothing when there are no In Tmux by agent issues', async () => {
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [],
      project: mockProject,
      cacheUsed: false,
    });

    await useCase.run(params);

    expect(
      mockTmuxSessionRepository.listLiveSessionNames,
    ).not.toHaveBeenCalled();
    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('does nothing when project has no Awaiting Workspace status', async () => {
    const projectWithoutAwaitingWorkspace: Project = {
      ...mockProject,
      status: {
        ...mockProject.status,
        statuses: mockProject.status.statuses.filter(
          (s) => s.name !== 'Awaiting Workspace',
        ),
      },
    };
    mockProjectRepository.getProject.mockResolvedValue(
      projectWithoutAwaitingWorkspace,
    );
    const issue = createMockIssue({ status: IN_TMUX_BY_AGENT_STATUS_NAME });
    mockIssueRepository.getAllIssues.mockResolvedValue({
      issues: [issue],
      project: projectWithoutAwaitingWorkspace,
      cacheUsed: false,
    });
    mockTmuxSessionRepository.listLiveSessionNames.mockResolvedValue([]);

    await useCase.run(params);

    expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('throws when project is not found by URL', async () => {
    mockProjectRepository.findProjectIdByUrl.mockResolvedValue(null);

    await expect(useCase.run(params)).rejects.toThrow(
      `Project not found. projectUrl: ${params.projectUrl}`,
    );
  });

  it('throws when getProject returns null', async () => {
    mockProjectRepository.getProject.mockResolvedValue(null);

    await expect(useCase.run(params)).rejects.toThrow('Project not found.');
  });
});
