import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './InTmuxByHumanSessionReconcileUseCase';
import { SilentLiveSessionNotifyUseCase } from './SilentLiveSessionNotifyUseCase';

const ASSIGNEE = 'owner-login';
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
}): Pick<
  TmuxSessionRepository,
  'listLiveSessionNames' | 'listInteractiveProcessCommandLines'
> => ({
  listLiveSessionNames: async () => state.liveSessionNames,
  listInteractiveProcessCommandLines: async () => state.processCommandLines,
});

describe('SilentLiveSessionNotifyUseCase', () => {
  beforeEach(() => {
    issueCounter = 0;
  });

  it('returns no silent sessions when there are no In Tmux by human target issues', async () => {
    const otherStatusIssue = makeIssue({ status: 'Done' });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(otherStatusIssue.url)],
      processCommandLines: [],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [otherStatusIssue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([]);
  });

  it('returns no silent sessions when all target issues have active Claude processes', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(issue.url)],
      processCommandLines: [`claude --name ${issue.url}`],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([]);
  });

  it('returns the issue url when a tmux session exists but no Claude process is running for it', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(issue.url)],
      processCommandLines: [],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([issue.url]);
  });

  it('does not count an issue as silent when its tmux session does not exist at all', async () => {
    const issue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [],
      processCommandLines: [],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [issue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([]);
  });

  it('returns only the silent issue url from a mix of healthy, silent, and session-less issues', async () => {
    const healthyIssue = makeIssue();
    const silentIssue = makeIssue();
    const noSessionIssue = makeIssue();
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [
        toTmuxSessionName(healthyIssue.url),
        toTmuxSessionName(silentIssue.url),
      ],
      processCommandLines: [`claude --name ${healthyIssue.url}`],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [healthyIssue, silentIssue, noSessionIssue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([silentIssue.url]);
  });

  it('ignores closed, wrong-status, wrong-assignee, future-date, and next-action-hour issues', async () => {
    const closedIssue = makeIssue({ isClosed: true });
    const otherStatusIssue = makeIssue({ status: 'In Progress' });
    const otherAssigneeIssue = makeIssue({ assignees: ['someone-else'] });
    const futureIssue = makeIssue({
      nextActionDate: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });
    const hourIssue = makeIssue({ nextActionHour: 9 });

    const allIssues = [
      closedIssue,
      otherStatusIssue,
      otherAssigneeIssue,
      futureIssue,
      hourIssue,
    ];
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: allIssues.map((i) => toTmuxSessionName(i.url)),
      processCommandLines: [],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: allIssues,
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([]);
  });

  it('includes an issue whose next action date is past due', async () => {
    const dueIssue = makeIssue({
      nextActionDate: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
    });
    const repository = createFakeTmuxSessionRepository({
      liveSessionNames: [toTmuxSessionName(dueIssue.url)],
      processCommandLines: [],
    });
    const useCase = new SilentLiveSessionNotifyUseCase(repository);

    const result = await useCase.run({
      issues: [dueIssue],
      assigneeLogin: ASSIGNEE,
      now: NOW,
    });

    expect(result.silentSessionIssueUrls).toEqual([dueIssue.url]);
  });
});
