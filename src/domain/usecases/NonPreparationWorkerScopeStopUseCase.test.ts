import { NonPreparationWorkerScopeStopUseCase } from './NonPreparationWorkerScopeStopUseCase';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockTmuxSessionRepository = (): Mocked<
  Pick<
    TmuxSessionRepository,
    'listRunningWorkerScopeUnitNames' | 'stopWorkerScopeUnit'
  >
> => ({
  listRunningWorkerScopeUnitNames: jest.fn(),
  stopWorkerScopeUnit: jest.fn(),
});

const createMockIssueRepository = (): Mocked<
  Pick<IssueRepository, 'get' | 'removeIssueFromProjectCache'>
> => ({
  get: jest.fn(),
  removeIssueFromProjectCache: jest.fn(),
});

const project: Project = {
  id: 'project-1',
  url: 'https://github.com/orgs/owner/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: { name: 'Status', fieldId: 'status-field', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

const buildIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'title',
  state: 'OPEN',
  status: PREPARATION_STATUS_NAME,
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'author',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('NonPreparationWorkerScopeStopUseCase', () => {
  it('keeps a running worker scope whose issue Status is Preparation', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-owner-repo-1-100.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'owner',
        repo: 'repo',
        number: 1,
        status: PREPARATION_STATUS_NAME,
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it.each([DONE_STATUS_NAME, AWAITING_WORKSPACE_STATUS_NAME, 'Icebox'])(
    'stops a running worker scope whose issue Status is %s',
    async (status) => {
      const tmuxSessionRepository = createMockTmuxSessionRepository();
      const issueRepository = createMockIssueRepository();
      tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
        'aw-owner-repo-1-100.scope',
      ]);
      issueRepository.get.mockResolvedValue(
        buildIssue({ org: 'owner', repo: 'repo', number: 1, status }),
      );
      const useCase = new NonPreparationWorkerScopeStopUseCase(
        tmuxSessionRepository,
        issueRepository,
      );

      const result = await useCase.run({
        issues: [buildIssue({ org: 'owner', repo: 'repo', number: 1, status })],
        currentProjectOrg: 'owner',
        project,
      });

      expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
        'aw-owner-repo-1-100.scope',
      );
      expect(result.stoppedScopeUnitNames).toEqual([
        'aw-owner-repo-1-100.scope',
      ]);
    },
  );

  it('skips a running worker scope whose unit name matches no known issue', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-someorg-somerepo-999-1234.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'owner',
        repo: 'repo',
        number: 1,
        status: DONE_STATUS_NAME,
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: DONE_STATUS_NAME,
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('returns an empty result when no worker scopes are running', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([]);
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('stops every non-Preparation scope and keeps every Preparation scope in one run', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-owner-repo-1-100.scope',
      'aw-owner-repo-2-200.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'owner',
        repo: 'repo',
        number: 2,
        status: DONE_STATUS_NAME,
        url: 'https://github.com/owner/repo/issues/2',
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/1',
        }),
        buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 2,
          status: DONE_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/2',
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledTimes(1);
    expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
      'aw-owner-repo-2-200.scope',
    );
    expect(result.stoppedScopeUnitNames).toEqual(['aw-owner-repo-2-200.scope']);
  });

  it('does not stop a running worker scope whose resolved issue is Preparation but belongs to a different org than the current project cycle', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-otherorg-repo-1-100.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'otherorg',
        repo: 'repo',
        number: 1,
        status: PREPARATION_STATUS_NAME,
        url: 'https://github.com/otherorg/repo/issues/1',
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'otherorg',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
          url: 'https://github.com/otherorg/repo/issues/1',
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('★ does not stop a running worker scope whose resolved issue is not Preparation but belongs to a different org than the current project cycle (regression: today this incorrectly stops it)', async () => {
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-otherorg-repo-1-100.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'otherorg',
        repo: 'repo',
        number: 1,
        status: AWAITING_WORKSPACE_STATUS_NAME,
        url: 'https://github.com/otherorg/repo/issues/1',
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    const result = await useCase.run({
      issues: [
        buildIssue({
          org: 'otherorg',
          repo: 'repo',
          number: 1,
          status: AWAITING_WORKSPACE_STATUS_NAME,
          url: 'https://github.com/otherorg/repo/issues/1',
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    expect(tmuxSessionRepository.stopWorkerScopeUnit).not.toHaveBeenCalled();
    expect(result.stoppedScopeUnitNames).toEqual([]);
  });

  it('logs a diagnostic identifying the scope unit name and the mismatched orgs when a mismatch is detected', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const tmuxSessionRepository = createMockTmuxSessionRepository();
    const issueRepository = createMockIssueRepository();
    tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
      'aw-otherorg-repo-1-100.scope',
    ]);
    issueRepository.get.mockResolvedValue(
      buildIssue({
        org: 'otherorg',
        repo: 'repo',
        number: 1,
        status: AWAITING_WORKSPACE_STATUS_NAME,
        url: 'https://github.com/otherorg/repo/issues/1',
      }),
    );
    const useCase = new NonPreparationWorkerScopeStopUseCase(
      tmuxSessionRepository,
      issueRepository,
    );

    await useCase.run({
      issues: [
        buildIssue({
          org: 'otherorg',
          repo: 'repo',
          number: 1,
          status: AWAITING_WORKSPACE_STATUS_NAME,
          url: 'https://github.com/otherorg/repo/issues/1',
        }),
      ],
      currentProjectOrg: 'owner',
      project,
    });

    const diagnosticLines = [
      ...consoleLogSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
    ].map((callArgs) => callArgs.join(' '));

    expect(
      diagnosticLines.some(
        (line) =>
          line.includes('aw-otherorg-repo-1-100.scope') &&
          line.includes('owner') &&
          line.includes('otherorg'),
      ),
    ).toBe(true);

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('live status re-check immediately before stopping a scope (issue 3192)', () => {
    it.each<{
      label: string;
      snapshotStatus: string;
      liveIssue: Issue | null;
      expectedStopped: boolean;
    }>([
      {
        label:
          'does not stop the scope when the live re-check shows the issue is now Preparation',
        snapshotStatus: AWAITING_WORKSPACE_STATUS_NAME,
        liveIssue: buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: PREPARATION_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/1',
        }),
        expectedStopped: false,
      },
      {
        label:
          'stops the scope when the live re-check shows the issue is still Awaiting Workspace',
        snapshotStatus: AWAITING_WORKSPACE_STATUS_NAME,
        liveIssue: buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: AWAITING_WORKSPACE_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/1',
        }),
        expectedStopped: true,
      },
      {
        label:
          'stops the scope when the live re-check shows the issue is still Done',
        snapshotStatus: DONE_STATUS_NAME,
        liveIssue: buildIssue({
          org: 'owner',
          repo: 'repo',
          number: 1,
          status: DONE_STATUS_NAME,
          url: 'https://github.com/owner/repo/issues/1',
        }),
        expectedStopped: true,
      },
      {
        label:
          'stops the scope when the live re-check shows the issue was removed from the project',
        snapshotStatus: AWAITING_WORKSPACE_STATUS_NAME,
        liveIssue: null,
        expectedStopped: true,
      },
    ])('$label', async ({ snapshotStatus, liveIssue, expectedStopped }) => {
      const tmuxSessionRepository = createMockTmuxSessionRepository();
      const issueRepository = createMockIssueRepository();
      tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
        'aw-owner-repo-1-100.scope',
      ]);
      issueRepository.get.mockResolvedValue(liveIssue);
      const useCase = new NonPreparationWorkerScopeStopUseCase(
        tmuxSessionRepository,
        issueRepository,
      );

      const result = await useCase.run({
        issues: [
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 1,
            status: snapshotStatus,
            url: 'https://github.com/owner/repo/issues/1',
          }),
        ],
        currentProjectOrg: 'owner',
        project,
      });

      if (expectedStopped) {
        expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
          'aw-owner-repo-1-100.scope',
        );
        expect(result.stoppedScopeUnitNames).toEqual([
          'aw-owner-repo-1-100.scope',
        ]);
      } else {
        expect(
          tmuxSessionRepository.stopWorkerScopeUnit,
        ).not.toHaveBeenCalled();
        expect(result.stoppedScopeUnitNames).toEqual([]);
      }
    });

    it("isolates one scope's live re-check failure so it does not stop that scope and does not abort evaluating the other running scope in the same run", async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const tmuxSessionRepository = createMockTmuxSessionRepository();
      const issueRepository = createMockIssueRepository();
      tmuxSessionRepository.listRunningWorkerScopeUnitNames.mockResolvedValue([
        'aw-owner-repo-1-100.scope',
        'aw-owner-repo-2-200.scope',
      ]);
      issueRepository.get
        .mockRejectedValueOnce(new Error('GraphQL rate limit exceeded'))
        .mockResolvedValueOnce(
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 2,
            status: AWAITING_WORKSPACE_STATUS_NAME,
            url: 'https://github.com/owner/repo/issues/2',
          }),
        );
      const useCase = new NonPreparationWorkerScopeStopUseCase(
        tmuxSessionRepository,
        issueRepository,
      );

      const result = await useCase.run({
        issues: [
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 1,
            status: AWAITING_WORKSPACE_STATUS_NAME,
            url: 'https://github.com/owner/repo/issues/1',
          }),
          buildIssue({
            org: 'owner',
            repo: 'repo',
            number: 2,
            status: AWAITING_WORKSPACE_STATUS_NAME,
            url: 'https://github.com/owner/repo/issues/2',
          }),
        ],
        currentProjectOrg: 'owner',
        project,
      });

      expect(result.stoppedScopeUnitNames).not.toContain(
        'aw-owner-repo-1-100.scope',
      );
      expect(result.stoppedScopeUnitNames).toContain(
        'aw-owner-repo-2-200.scope',
      );
      expect(
        tmuxSessionRepository.stopWorkerScopeUnit,
      ).not.toHaveBeenCalledWith('aw-owner-repo-1-100.scope');
      expect(tmuxSessionRepository.stopWorkerScopeUnit).toHaveBeenCalledWith(
        'aw-owner-repo-2-200.scope',
      );
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
