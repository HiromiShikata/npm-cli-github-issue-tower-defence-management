import * as fs from 'node:fs';
import type * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Issue } from '../../../../../domain/entities/Issue';
import type { Project } from '../../../../../domain/entities/Project';
import type {
  IssueComment,
  IssueRepository,
  PullRequestCommit,
  PullRequestDetail,
  RelatedPullRequest,
} from '../../../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { ConsoleProjectBinding } from '../../consoleOperationApi';
import { IssueTitleStateCache } from '../../consoleReadApi';
import { startWebServer } from '../../webServer';

export const CONSOLE_E2E_PJCODE = 'umino';
export const CONSOLE_E2E_TOKEN = 'console-e2e-fixture-token-3f9c1a';

type ConsoleFixtureListItem = {
  number: number;
  title: string;
  url: string;
  repo: string;
  nameWithOwner: string;
  projectItemId: string;
  itemId: string;
  isPr: boolean;
  story: string;
  status: string | null;
  nextActionDate: string | null;
  nextActionHour: number | null;
  dependedIssueUrls: string[];
  labels: string[];
  createdAt: string;
};

type ConsoleFixtureFieldOption = {
  id: string;
  name: string;
  color: string;
};

type ConsoleFixtureSnapshot = {
  pjcode: string;
  generatedAt: string;
  statusOptions: ConsoleFixtureFieldOption[];
  storyOptions: ConsoleFixtureFieldOption[];
  storyColors: Record<string, { color: string }>;
  items: ConsoleFixtureListItem[];
};

const REPO_NAME_WITH_OWNER =
  'HiromiShikata/npm-cli-github-issue-tower-defence-management';

const AWAITING_WORKSPACE_OPTION: ConsoleFixtureFieldOption = {
  id: 'd1c19cce',
  name: 'Awaiting Workspace',
  color: 'BLUE',
};

const STATUS_OPTIONS: ConsoleFixtureFieldOption[] = [
  { id: 'f75ad846', name: 'Unread', color: 'ORANGE' },
  AWAITING_WORKSPACE_OPTION,
  { id: 'f57f1ce9', name: 'Preparation', color: 'YELLOW' },
  { id: 'fd313492', name: 'Failed Preparation', color: 'RED' },
  { id: 'e9931e57', name: 'Todo by human', color: 'PINK' },
  { id: 'c2d278b2', name: 'In Tmux by human', color: 'RED' },
  { id: 'e9f6a726', name: 'In Tmux by agent', color: 'YELLOW' },
];

const STORY_OPTIONS: ConsoleFixtureFieldOption[] = [
  { id: '1491051e', name: 'TDPM Console port', color: 'BLUE' },
  { id: '28415d6c', name: 'regular / workflow improvement', color: 'GRAY' },
  {
    id: 'f7cd5cbc',
    name: 'Publish product documentation site',
    color: 'GREEN',
  },
  { id: 'a3b9c4d2', name: 'regular / WORKFLOW BLOCKER', color: 'RED' },
];

const STORY_COLORS: Record<string, { color: string }> = {
  'TDPM Console port': { color: 'BLUE' },
  'regular / workflow improvement': { color: 'GRAY' },
  'Publish product documentation site': { color: 'GREEN' },
  'regular / WORKFLOW BLOCKER': { color: 'RED' },
};

const issueItem = (
  number: number,
  title: string,
  projectItemSuffix: string,
  story: string,
  createdAt: string,
): ConsoleFixtureListItem => ({
  number,
  title,
  url: `https://github.com/${REPO_NAME_WITH_OWNER}/issues/${number}`,
  repo: REPO_NAME_WITH_OWNER,
  nameWithOwner: REPO_NAME_WITH_OWNER,
  projectItemId: `PVTI_lADOABCD1234zg${projectItemSuffix}`,
  itemId: `PVTI_lADOABCD1234zg${projectItemSuffix}`,
  isPr: false,
  story,
  status: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt,
});

const pullRequestItem = (
  number: number,
  title: string,
  projectItemSuffix: string,
  story: string,
  createdAt: string,
): ConsoleFixtureListItem => ({
  number,
  title,
  url: `https://github.com/${REPO_NAME_WITH_OWNER}/pull/${number}`,
  repo: REPO_NAME_WITH_OWNER,
  nameWithOwner: REPO_NAME_WITH_OWNER,
  projectItemId: `PVTI_lADOABCD1234zg${projectItemSuffix}`,
  itemId: `PVTI_lADOABCD1234zg${projectItemSuffix}`,
  isPr: true,
  story,
  status: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: ['claude'],
  createdAt,
});

const buildSnapshot = (
  items: ConsoleFixtureListItem[],
): ConsoleFixtureSnapshot => ({
  pjcode: CONSOLE_E2E_PJCODE,
  generatedAt: '2026-06-18T01:22:09.000Z',
  statusOptions: STATUS_OPTIONS,
  storyOptions: STORY_OPTIONS,
  storyColors: STORY_COLORS,
  items,
});

export const CONSOLE_E2E_TAB_ITEMS: Record<string, ConsoleFixtureListItem[]> = {
  'workflow-blocker': [
    issueItem(
      720,
      'Resolve the shared GitHub token rate-limit exhaustion blocker',
      'WFB00720',
      'regular / WORKFLOW BLOCKER',
      '2026-06-11T08:30:00.000Z',
    ),
  ],
  prs: [
    pullRequestItem(
      867,
      'Serve the committed console UI bundle from serveConsole',
      'PRS00867',
      'TDPM Console port',
      '2026-06-17T23:41:08.000Z',
    ),
  ],
  triage: [
    issueItem(
      778,
      'Add Sonnet to Opus weekly-limit fallback routing per token',
      'TRI00778',
      'regular / workflow improvement',
      '2026-06-12T23:01:55.000Z',
    ),
    issueItem(
      692,
      'Publish the generated documentation site to GitHub Pages',
      'TRI00692',
      'Publish product documentation site',
      '2026-06-10T11:42:00.000Z',
    ),
  ],
  unread: [
    issueItem(
      845,
      'Scaffold React console UI under entry-points with build bundling',
      'UNR00845',
      'TDPM Console port',
      '2026-06-16T22:01:55.000Z',
    ),
    issueItem(
      853,
      'Add server-side console API handlers for read and operation endpoints',
      'UNR00853',
      'TDPM Console port',
      '2026-06-17T05:48:09.000Z',
    ),
  ],
  'failed-preparation': [],
  'todo-by-human': [
    issueItem(
      869,
      'Auto-advance to the next non-empty console tab when one empties',
      'TODO00869',
      'TDPM Console port',
      '2026-06-18T00:14:51.000Z',
    ),
  ],
};

const writeFixtureData = (consoleDataOutputDir: string): void => {
  for (const [tab, items] of Object.entries(CONSOLE_E2E_TAB_ITEMS)) {
    const tabDir = path.join(consoleDataOutputDir, CONSOLE_E2E_PJCODE, tab);
    fs.mkdirSync(tabDir, { recursive: true });
    fs.writeFileSync(
      path.join(tabDir, 'list.json'),
      JSON.stringify(buildSnapshot(items)),
    );
  }
};

const buildE2eProject = (): Project => ({
  id: 'PVT_console_e2e',
  url: `https://github.com/orgs/HiromiShikata/projects/1`,
  databaseId: 1,
  name: 'TDPM',
  status: {
    name: 'Status',
    fieldId: 'PVTSSF_status',
    statuses: STATUS_OPTIONS.map((option) => ({
      id: option.id,
      name: option.name,
      color: option.color as Project['status']['statuses'][number]['color'],
      description: '',
    })),
  },
  nextActionDate: { name: 'Next Action Date', fieldId: 'PVTF_nad' },
  nextActionHour: { name: 'Next Action Hour', fieldId: 'PVTF_nah' },
  story: {
    name: 'Story',
    fieldId: 'PVTSSF_story',
    databaseId: 2,
    stories: STORY_OPTIONS.map((option) => ({
      id: option.id,
      name: option.name,
      color: option.color as Project['status']['statuses'][number]['color'],
      description: '',
    })),
    workflowManagementStory: { id: 'wms_1', name: 'regular / workflow' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const buildIssueForUrl = (url: string): Issue => ({
  nameWithOwner: REPO_NAME_WITH_OWNER,
  number: 0,
  title: 'Console E2E fixture issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url,
  assignees: [],
  labels: [],
  org: 'HiromiShikata',
  repo: 'npm-cli-github-issue-tower-defence-management',
  body: 'Console E2E fixture issue body.',
  itemId: '',
  isPr: url.includes('/pull/'),
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-06-18T00:00:00.000Z'),
  author: 'HiromiShikata',
  closingIssueReferenceUrls: [],
});

const notImplemented = (method: string): never => {
  throw new Error(`console E2E stub does not implement ${method}`);
};

const createStubIssueRepository = (): IssueRepository => ({
  getAllIssues: () => notImplemented('getAllIssues'),
  getIssueByUrl: async (url: string): Promise<Issue | null> =>
    buildIssueForUrl(url),
  createNewIssue: () => notImplemented('createNewIssue'),
  searchIssue: () => notImplemented('searchIssue'),
  updateIssue: () => notImplemented('updateIssue'),
  updateNextActionDate: async (): Promise<void> => undefined,
  updateNextActionHour: () => notImplemented('updateNextActionHour'),
  updateProjectTextField: () => notImplemented('updateProjectTextField'),
  updateStory: async (): Promise<void> => undefined,
  updateStatus: async (): Promise<void> => undefined,
  clearProjectField: () => notImplemented('clearProjectField'),
  createComment: () => notImplemented('createComment'),
  updateLabels: () => notImplemented('updateLabels'),
  removeLabel: () => notImplemented('removeLabel'),
  updateAssigneeList: () => notImplemented('updateAssigneeList'),
  get: async (issueUrl: string): Promise<Issue | null> =>
    buildIssueForUrl(issueUrl),
  update: () => notImplemented('update'),
  findRelatedOpenPRs: async (): Promise<RelatedPullRequest[]> => [],
  getOpenPullRequest: async (): Promise<RelatedPullRequest | null> => null,
  getPullRequestChangedFilePaths: async (): Promise<string[]> => [],
  approvePullRequest: async (): Promise<void> => undefined,
  requestChangesWithInlineComment: async (): Promise<void> => undefined,
  createPullRequestReviewComment: async (): Promise<void> => undefined,
  closePullRequest: async (): Promise<void> => undefined,
  closeIssueByUrl: async (): Promise<void> => undefined,
  deletePullRequestBranch: () => notImplemented('deletePullRequestBranch'),
  createCommentByUrl: async (): Promise<void> => undefined,
  getAllOpened: () => notImplemented('getAllOpened'),
  getStoryObjectMap: () => notImplemented('getStoryObjectMap'),
  addIssueToProject: () => notImplemented('addIssueToProject'),
  setDependedIssueUrl: () => notImplemented('setDependedIssueUrl'),
  getIssueOrPullRequestBody: async (): Promise<string> =>
    '## Console E2E fixture\n\nThis body is served by the isolated E2E stub.',
  getIssueOrPullRequestComments: async (): Promise<IssueComment[]> => [],
  getPullRequestDetail: async (): Promise<PullRequestDetail | null> => null,
  getPullRequestCommits: async (): Promise<PullRequestCommit[]> => [],
  getIssueOrPullRequestState: async (
    url: string,
  ): Promise<{ state: string; merged: boolean; isPullRequest: boolean }> => ({
    state: 'open',
    merged: false,
    isPullRequest: url.includes('/pull/'),
  }),
  getPullRequestSummary: async (): Promise<{
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  } | null> => null,
});

export type ConsoleE2eHarness = {
  baseUrl: string;
  appUrl: string;
  appRootUrl: string;
  consoleDataOutputDir: string;
  stop: () => Promise<void>;
};

export const startConsoleE2eHarness = async (): Promise<ConsoleE2eHarness> => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'console-e2e-'));
  const consoleDataOutputDir = path.join(tmpRoot, 'data');
  writeFixtureData(consoleDataOutputDir);

  const uiDistDir = path.resolve(__dirname, '..', '..', 'ui-dist');

  const project = buildE2eProject();
  const resolveProject = async (
    pjcode: string,
  ): Promise<ConsoleProjectBinding | null> =>
    pjcode === CONSOLE_E2E_PJCODE ? { pjcode, project } : null;

  const server = await startWebServer({
    accessToken: CONSOLE_E2E_TOKEN,
    uiDistDir,
    consoleDataOutputDir,
    issueRepository: createStubIssueRepository(),
    resolveProject,
    issueTitleStateCache: new IssueTitleStateCache(),
    inTmuxDataDir: null,
    dashboardDataDir: null,
    dashboardProjectCodes: [],
    port: 0,
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    await closeServer(server);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    throw new Error('console E2E server is not listening on a TCP port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const appUrl = `${baseUrl}/projects/${CONSOLE_E2E_PJCODE}/prs?k=${CONSOLE_E2E_TOKEN}`;
  const appRootUrl = `${baseUrl}/projects/${CONSOLE_E2E_PJCODE}?k=${CONSOLE_E2E_TOKEN}`;

  return {
    baseUrl,
    appUrl,
    appRootUrl,
    consoleDataOutputDir,
    stop: async (): Promise<void> => {
      await closeServer(server);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    },
  };
};

const closeServer = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
