import { Project } from '../../entities/Project';
import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { IssueRepository } from '../adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import {
  InTmuxByHumanSessionReconcileUseCase,
  toTmuxSessionName,
} from './InTmuxByHumanSessionReconcileUseCase';

const ASSIGNEE = 'owner-login';
const LAUNCHER = 'cl';
const NOW = new Date('2026-06-25T12:00:00.000Z');

const PROJECT: Project = {
  id: 'selected-project',
  url: 'https://github.com/users/demo/projects/9',
  databaseId: 9,
  name: 'Selected project',
  status: { name: 'Status', fieldId: 'selected-status', statuses: [] },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
};

let issueCounter = 0;
const makeIssue = (overrides: Partial<Issue> = {}): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'demo/repo',
    number: issueCounter,
    title: `Issue ${issueCounter}`,
    state: 'OPEN',
    status: IN_TMUX_STATUS_NAME,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: `https://github.com/demo/repo/issues/${issueCounter}`,
    assignees: [ASSIGNEE],
    labels: [],
    org: 'demo',
    repo: 'repo',
    body: '',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date(),
    author: '',
    closingIssueReferenceUrls: [],
    plainCrossRepoIssueReferenceUrls: [],
    agent: null,
    stateReason: null,
    ...overrides,
  };
};

const createFakeTmuxSessionRepository = (state: {
  liveSessionNames: string[];
  processCommandLines: string[];
}): TmuxSessionRepository & {
  launches: {
    sessionName: string;
    launcherCommand: string;
    issueUrl: string;
  }[];
} => {
  const launches: {
    sessionName: string;
    launcherCommand: string;
    issueUrl: string;
  }[] = [];
  return {
    launches,
    ...{ listSessionNamesForIssueUrl: async (): Promise<string[]> => [] },
    listLiveSessionNames: async () => state.liveSessionNames,
    listLiveSessionsWithActivity: async () =>
      state.liveSessionNames.map((sessionName) => ({
        sessionName,
        activityEpochSeconds: 0,
      })),
    listInteractiveProcessCommandLines: async () => state.processCommandLines,
    listRunningWorkerScopeUnitNames: async () => [],
    stopWorkerScopeUnit: async () => undefined,
    launchDetachedSession: async (sessionName, launcherCommand, issueUrl) => {
      launches.push({ sessionName, launcherCommand, issueUrl });
    },
    killSession: async () => undefined,
    killOwnSession: async () => undefined,
    sendKeys: async () => undefined,
    attachOrCreateInteractiveSession: async () => undefined,
  };
};

const createFakeIssueStateRepository = (
  stateByUrl: Record<string, string> = {},
): Pick<
  IssueRepository,
  'getIssueOrPullRequestState' | 'getIssueByUrl' | 'get'
> & {
  fetchedUrls: string[];
} => {
  const fetchedUrls: string[] = [];
  return {
    fetchedUrls,
    get: async (url, project) => {
      expect(project).toBe(PROJECT);
      fetchedUrls.push(url);
      return makeIssue({
        url,
        isClosed: stateByUrl[url] === 'closed',
        state: stateByUrl[url] === 'closed' ? 'CLOSED' : 'OPEN',
      });
    },
    getIssueByUrl: async (url, options) => {
      expect(options).toEqual({ bypassCache: true });
      fetchedUrls.push(url);
      return makeIssue({
        url,
        isClosed: stateByUrl[url] === 'closed',
        state: stateByUrl[url] === 'closed' ? 'CLOSED' : 'OPEN',
      });
    },
    getIssueOrPullRequestState: async (url: string) => {
      fetchedUrls.push(url);
      return {
        state: stateByUrl[url] ?? 'open',
        merged: false,
        isPullRequest: false,
        title: `Title of ${url}`,
        stateReason: '',
      };
    },
  };
};

const runReconcile = (
  useCase: InTmuxByHumanSessionReconcileUseCase,
  params: Omit<
    Parameters<InTmuxByHumanSessionReconcileUseCase['run']>[0],
    'project'
  >,
) => {
  const input = { ...params, project: PROJECT };
  return useCase.run(input);
};

describe('InTmuxByHumanSessionReconcileUseCase', () => {
  beforeEach(() => {
    issueCounter = 0;
  });

  it('launches one session for an unheld open assigned issue', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([
      {
        sessionName: toTmuxSessionName(issue.url),
        launcherCommand: LAUNCHER,
        issueUrl: issue.url,
      },
    ]);
    expect(result.launchedIssueUrls).toEqual([issue.url]);
  });

  it('does not launch when a live session already exists for the issue', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(issue.url)],
      processCommandLines: [
        `claude --model opus --agent leader --name ${issue.url}`,
      ],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('treats a session as missing when the tmux session exists but no process advertises the issue url', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(issue.url)],
      processCommandLines: ['claude --model opus --name some-other-task'],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toHaveLength(1);
    expect(result.launchedIssueUrls).toEqual([issue.url]);
  });

  it('launches only the missing sessions across multiple In Tmux by human issues', async () => {
    const liveIssue = makeIssue();
    const missingIssueOne = makeIssue();
    const missingIssueTwo = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(liveIssue.url)],
      processCommandLines: [`claude --model opus --name ${liveIssue.url}`],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [liveIssue, missingIssueOne, missingIssueTwo],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(result.launchedIssueUrls).toEqual([
      missingIssueOne.url,
      missingIssueTwo.url,
    ]);
    expect(repository.launches.map((launch) => launch.issueUrl)).toEqual([
      missingIssueOne.url,
      missingIssueTwo.url,
    ]);
  });

  it('ignores issues that are not In Tmux by human, closed, or assigned to another login', async () => {
    const otherStatusIssue = makeIssue({ status: 'Done' });
    const closedIssue = makeIssue({ isClosed: true });
    const otherAssigneeIssue = makeIssue({ assignees: ['someone-else'] });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [otherStatusIssue, closedIssue, otherAssigneeIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('excludes an issue whose next action date is in the future', async () => {
    const futureIssue = makeIssue({
      nextActionDate: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [futureIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('excludes an issue whose next action hour is set', async () => {
    const hourIssue = makeIssue({ nextActionHour: 9 });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [hourIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('excludes an issue whose next action date is in the past and is now due', async () => {
    const dueIssue = makeIssue({
      nextActionDate: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [dueIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('does not launch a session for an issue whose live GitHub state is closed even when the cached issue still reports it as open', async () => {
    const staleCachedIssue = makeIssue({ isClosed: false });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const issueStateRepository = createFakeIssueStateRepository({
      [staleCachedIssue.url]: 'closed',
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      issueStateRepository,
    );

    const result = await runReconcile(useCase, {
      issues: [staleCachedIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(issueStateRepository.fetchedUrls).toEqual([staleCachedIssue.url]);
    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('launches only the issues whose live GitHub state is open when a stale cached issue is mixed in', async () => {
    const staleClosedIssue = makeIssue({ isClosed: false });
    const openIssue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const issueStateRepository = createFakeIssueStateRepository({
      [staleClosedIssue.url]: 'closed',
      [openIssue.url]: 'open',
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      issueStateRepository,
    );

    const result = await runReconcile(useCase, {
      issues: [staleClosedIssue, openIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(result.launchedIssueUrls).toEqual([openIssue.url]);
    expect(repository.launches.map((launch) => launch.issueUrl)).toEqual([
      openIssue.url,
    ]);
  });

  it('does not fetch the live state for an issue that already has a live session', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(issue.url)],
      processCommandLines: [
        `claude --model opus --agent leader --name ${issue.url}`,
      ],
    });
    const issueStateRepository = createFakeIssueStateRepository();
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      issueStateRepository,
    );

    await runReconcile(useCase, {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(issueStateRepository.fetchedUrls).toEqual([]);
  });

  it('does not launch when claude is running for the issue url even when the tmux session was renamed by cl', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: ['a1b2c3d4e5f6a7b8'],
      processCommandLines: [
        `claude --model opus --agent leader --name ${issue.url}`,
      ],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await runReconcile(useCase, {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('skips launch when a live hold appears', async () => {
    for (const hold of [
      { dependedIssueUrls: ['https://github.com/demo/repo/issues/99'] },
      { nextActionDate: new Date('2020-01-01T00:00:00Z') },
      { nextActionDate: NOW },
      { nextActionDate: new Date('2030-01-01T00:00:00Z') },
      { nextActionHour: 0 },
      { nextActionHour: 23 },
    ]) {
      const issue = makeIssue();
      const repository = createFakeTmuxSessionRepository({
        liveSessionNames: [],
        processCommandLines: [],
      });
      const issueRepository = createFakeIssueStateRepository();
      issueRepository.get = jest.fn().mockResolvedValue({ ...issue, ...hold });
      const useCase = new InTmuxByHumanSessionReconcileUseCase(
        repository,
        issueRepository,
      );
      const result = await runReconcile(useCase, {
        issues: [issue],
        assigneeLogin: ASSIGNEE,
        launcherCommand: LAUNCHER,
        now: NOW,
      });
      expect(issueRepository.get).toHaveBeenCalledWith(issue.url, PROJECT);
      expect(repository.launches).toEqual([]);
      expect(result.launchedIssueUrls).toEqual([]);
    }
  });

  it('resumes ordinary launch after all hold fields clear', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const issueRepository = createFakeIssueStateRepository();
    issueRepository.get = jest
      .fn()
      .mockResolvedValueOnce({ ...issue, nextActionHour: 0 })
      .mockResolvedValueOnce(issue);
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      issueRepository,
    );
    const params = {
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    };
    expect((await runReconcile(useCase, params)).launchedIssueUrls).toEqual([]);
    expect((await runReconcile(useCase, params)).launchedIssueUrls).toEqual([
      issue.url,
    ]);
    expect(repository.launches).toHaveLength(1);
  });

  it('fails closed when the live issue is absent or unreadable', async () => {
    for (const unreadable of [false, true]) {
      const issue = makeIssue();
      const repository = createFakeTmuxSessionRepository({
        liveSessionNames: [],
        processCommandLines: [],
      });
      const issueRepository = createFakeIssueStateRepository();
      issueRepository.get = unreadable
        ? jest.fn().mockRejectedValue(new Error('live read failed'))
        : jest.fn().mockResolvedValue(null);
      const useCase = new InTmuxByHumanSessionReconcileUseCase(
        repository,
        issueRepository,
      );
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        await runReconcile(useCase, {
          issues: [issue],
          assigneeLogin: ASSIGNEE,
          launcherCommand: LAUNCHER,
          now: NOW,
        });
      } catch (error) {
        expect(String(error)).toContain('live read failed');
      }
      expect(repository.launches).toEqual([]);
      errorSpy.mockRestore();
    }
  });

  it('transforms an issue url into the same session name tmux derives from the raw url, replacing only "." and ":" and keeping "/"', () => {
    expect(toTmuxSessionName('https://github.com/demo/repo/issues/42')).toBe(
      'https_//github_com/demo/repo/issues/42',
    );
  });
  it('continues independent launch candidates and propagates live read failures', async () => {
    const unreadableIssue = makeIssue();
    const readableIssue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const issueRepository = createFakeIssueStateRepository();
    issueRepository.get = jest
      .fn()
      .mockRejectedValueOnce(new Error('live issue read failed'))
      .mockResolvedValueOnce(readableIssue);
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      issueRepository,
    );
    await expect(
      runReconcile(useCase, {
        issues: [unreadableIssue, readableIssue],
        assigneeLogin: ASSIGNEE,
        launcherCommand: LAUNCHER,
        now: NOW,
      }),
    ).rejects.toThrow();
    expect(repository.launches.map((launch) => launch.issueUrl)).toEqual([
      readableIssue.url,
    ]);
  });
  it.each([true, false])(
    'uses the selected project live hold when membership fields disagree: selected held=%s',
    async (selectedHeld) => {
      const issue = makeIssue();
      const otherProject: Project = {
        ...PROJECT,
        id: 'other-project',
        databaseId: 10,
        url: 'https://github.com/users/demo/projects/10',
      };
      const selectedIssue = {
        ...issue,
        nextActionHour: selectedHeld ? 0 : null,
      };
      const otherIssue = { ...issue, nextActionHour: selectedHeld ? null : 0 };
      const issueRepository = createFakeIssueStateRepository();
      const projectMemberships = new Map([
        [PROJECT.id, selectedIssue],
        [otherProject.id, otherIssue],
      ]);
      issueRepository.get = jest
        .fn()
        .mockImplementation(
          async (_url: string, project: Project) =>
            projectMemberships.get(project.id) ?? null,
        );
      issueRepository.getIssueByUrl = jest.fn().mockResolvedValue(otherIssue);
      const repository = createFakeTmuxSessionRepository({
        liveSessionNames: [],
        processCommandLines: [],
      });
      const useCase = new InTmuxByHumanSessionReconcileUseCase(
        repository,
        issueRepository,
      );
      const result = await runReconcile(useCase, {
        issues: [issue],
        assigneeLogin: ASSIGNEE,
        launcherCommand: LAUNCHER,
        now: NOW,
      });
      expect(result.launchedIssueUrls).toEqual(selectedHeld ? [] : [issue.url]);
      expect(repository.launches.map((launch) => launch.issueUrl)).toEqual(
        selectedHeld ? [] : [issue.url],
      );
      expect(issueRepository.get).toHaveBeenCalledTimes(1);
      expect(issueRepository.get).toHaveBeenCalledWith(issue.url, PROJECT);
      expect(issueRepository.getIssueByUrl).not.toHaveBeenCalled();
    },
  );
});
