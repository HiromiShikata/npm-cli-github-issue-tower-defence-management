import { Issue } from '../../entities/Issue';
import { IN_TMUX_STATUS_NAME } from '../../entities/WorkflowStatus';
import { FieldOption, Project } from '../../entities/Project';
import { UnansweredOwnerCall } from '../../entities/UnansweredOwnerCall';
import { IssueRepository } from '../adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import { InTmuxByHumanSessionReconcileUseCase } from './InTmuxByHumanSessionReconcileUseCase';
import { GenerateInTmuxByHumanDataUseCase } from './GenerateInTmuxByHumanDataUseCase';

const ASSIGNEE = 'owner-login';
const LAUNCHER = 'cl';
const NOW = new Date('2026-06-25T12:00:00.000Z');
const ISSUE_URL = 'https://github.com/demo/repo/issues/1';
const STORY_NAME = 'Story Alpha';

const fieldOption = (id: string, name: string): FieldOption => ({
  id,
  name,
  color: 'BLUE',
  description: '',
});

const projectWithStory: Project = {
  id: 'project-node-id',
  url: 'https://github.com/orgs/demo/projects/1',
  databaseId: 1,
  name: 'demo',
  status: {
    name: 'Status',
    fieldId: 'status-field',
    statuses: [fieldOption('st-tmux', IN_TMUX_STATUS_NAME)],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'story',
    fieldId: 'story-field',
    databaseId: 2,
    stories: [fieldOption('s1', STORY_NAME)],
    workflowManagementStory: { id: 'wm', name: 'workflow management' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
};

const inTmuxIssue: Issue = {
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: IN_TMUX_STATUS_NAME,
  story: STORY_NAME,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: ISSUE_URL,
  assignees: [ASSIGNEE],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: NOW,
  author: '',
  closingIssueReferenceUrls: [],
};

const tmuxSessionNameTheReconcilerCreatesFor = async (
  issue: Issue,
): Promise<string> => {
  const launchedSessionNames: string[] = [];
  const tmuxSessionRepository: TmuxSessionRepository = {
    listLiveSessionNames: async () => [],
    listLiveSessionsWithActivity: async () => [],
    listInteractiveProcessCommandLines: async () => [],
    launchDetachedSession: async (sessionName: string) => {
      launchedSessionNames.push(sessionName);
    },
    killSession: async () => undefined,
    killOwnSession: async () => undefined,
    sendKeys: async () => undefined,
    launchBareNameLeaderSession: async () => undefined,
  };
  const issueStateRepository: Pick<
    IssueRepository,
    'getIssueOrPullRequestState'
  > = {
    getIssueOrPullRequestState: async () => ({
      state: 'OPEN',
      merged: false,
      isPullRequest: false,
    }),
  };

  await new InTmuxByHumanSessionReconcileUseCase(
    tmuxSessionRepository,
    issueStateRepository,
  ).run({
    issues: [issue],
    assigneeLogin: ASSIGNEE,
    launcherCommand: LAUNCHER,
    now: NOW,
  });

  return launchedSessionNames[0];
};

describe('unanswered owner call session key contract', () => {
  it('reads the calls under the very tmux session name the reconciler creates for that issue', async () => {
    const call: UnansweredOwnerCall = {
      calledAt: '2026-06-25T11:00:00.000Z',
      body: 'Please decide whether to merge the release branch',
    };
    const sessionNameTheReconcilerCreates =
      await tmuxSessionNameTheReconcilerCreatesFor(inTmuxIssue);

    const result = new GenerateInTmuxByHumanDataUseCase().run({
      project: projectWithStory,
      issues: [inTmuxIssue],
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      org: 'demo',
      repo: 'repo',
      consoleBaseUrl: 'https://console.example.test',
      consoleToken: 'test-token-value',
      unansweredCallsByTmuxSessionName: new Map([
        [sessionNameTheReconcilerCreates, [call]],
      ]),
      now: NOW,
    });

    expect(result.v5?.groups[0].sessions[0].unansweredCalls).toEqual([call]);
  });
});
