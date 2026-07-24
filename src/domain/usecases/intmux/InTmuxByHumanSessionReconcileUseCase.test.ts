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
    listLiveSessionNames: async () => state.liveSessionNames,
    listLiveSessionsWithActivity: async () =>
      state.liveSessionNames.map((sessionName) => ({
        sessionName,
        activityEpochSeconds: 0,
      })),
    listInteractiveProcessCommandLines: async () => state.processCommandLines,
    launchDetachedSession: async (sessionName, launcherCommand, issueUrl) => {
      launches.push({ sessionName, launcherCommand, issueUrl });
    },
    killSession: async () => undefined,
  };
};

const createFakeIssueStateRepository = (
  stateByUrl: Record<string, string> = {},
): Pick<IssueRepository, 'getIssueOrPullRequestState'> & {
  fetchedUrls: string[];
} => {
  const fetchedUrls: string[] = [];
  return {
    fetchedUrls,
    getIssueOrPullRequestState: async (url: string) => {
      fetchedUrls.push(url);
      return {
        state: stateByUrl[url] ?? 'open',
        merged: false,
        isPullRequest: false,
      };
    },
  };
};

describe('InTmuxByHumanSessionReconcileUseCase', () => {
  beforeEach(() => {
    issueCounter = 0;
  });

  it('launches a detached session for an In Tmux by human issue with no live session', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new InTmuxByHumanSessionReconcileUseCase(
      repository,
      createFakeIssueStateRepository(),
    );

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    const result = await useCase.run({
      issues: [hourIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(repository.launches).toEqual([]);
    expect(result.launchedIssueUrls).toEqual([]);
  });

  it('includes an issue whose next action date is in the past and is now due', async () => {
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

    const result = await useCase.run({
      issues: [dueIssue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(result.launchedIssueUrls).toEqual([dueIssue.url]);
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

    const result = await useCase.run({
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

    const result = await useCase.run({
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

    await useCase.run({
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      launcherCommand: LAUNCHER,
      now: NOW,
    });

    expect(issueStateRepository.fetchedUrls).toEqual([]);
  });

  it('transforms an issue url into the same session name tmux derives from the raw url, replacing only "." and ":" and keeping "/"', () => {
    expect(toTmuxSessionName('https://github.com/demo/repo/issues/42')).toBe(
      'https_//github_com/demo/repo/issues/42',
    );
  });
});
