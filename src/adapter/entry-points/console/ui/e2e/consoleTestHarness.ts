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
  PullRequestFile,
  RelatedPullRequest,
} from '../../../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { ConsoleProjectBinding } from '../../consoleOperationApi';
import {
  IssueTitleStateCache,
  PullRequestStatusCache,
} from '../../consoleReadApi';
import { startWebServer } from '../../webServer';

export const CONSOLE_E2E_PJCODE = 'umino';
export const CONSOLE_E2E_TOKEN = 'console-e2e-fixture-token-3f9c1a';

export type ConsoleE2eReviewCommentCall = {
  url: string;
  path: string;
  line: number;
  side: string;
  body: string;
};

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

export const CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/pull/867`;
export const CONSOLE_E2E_INLINE_COMMENT_ISSUE_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/issues/911`;
export const CONSOLE_E2E_INLINE_COMMENT_PR_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/pull/912`;

const INLINE_COMMENT_PR_FILE: PullRequestFile = {
  filename: 'src/adapter/entry-points/console/ui/src/index.css',
  status: 'modified',
  additions: 3,
  deletions: 1,
  patch: `@@ -959,7 +959,9 @@
   background: transparent;
   color: #6e7681;
   font-size: 0.875rem;
   cursor: pointer;
-  opacity: 0;
+  opacity: 0.6;
+  border-color: #30363d;
 }`,
};

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
  'failed-preparation': [
    issueItem(
      911,
      'Add inline review comments on the related pull request diff',
      'FPR00911',
      'TDPM Console port',
      '2026-06-18T03:12:00.000Z',
    ),
  ],
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

const inlineCommentRelatedPullRequest: RelatedPullRequest = {
  url: CONSOLE_E2E_INLINE_COMMENT_PR_URL,
  branchName: 'feature/911-related-pr-inline-comments',
  createdAt: new Date('2026-06-18T03:30:00.000Z'),
  isDraft: false,
  isConflicted: true,
  mergeable: 'CONFLICTING',
  isPassedAllCiJob: false,
  isCiStateSuccess: false,
  isResolvedAllReviewComments: false,
  isBranchOutOfDate: true,
  missingRequiredCheckNames: ['build', 'test'],
};

const awaitingQualityCheckPullRequest: RelatedPullRequest = {
  url: CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL,
  branchName: 'i867-serve-committed-console-ui-bundle',
  createdAt: new Date('2026-06-17T23:41:08.000Z'),
  isDraft: false,
  isConflicted: true,
  mergeable: 'CONFLICTING',
  isPassedAllCiJob: false,
  isCiStateSuccess: false,
  isResolvedAllReviewComments: false,
  isBranchOutOfDate: true,
  missingRequiredCheckNames: ['build', 'test'],
};

const inlineCommentPullRequestDetail: PullRequestDetail = {
  title: 'Add inline review comments on the related pull request diff',
  state: 'open',
  merged: false,
  isDraft: false,
  additions: 3,
  deletions: 1,
  changedFiles: 1,
  headRefName: 'feature/911-related-pr-inline-comments',
  baseRefName: 'main',
  author: 'HiromiShikata',
  files: [INLINE_COMMENT_PR_FILE],
};

const createStubIssueRepository = (
  reviewCommentCalls: ConsoleE2eReviewCommentCall[],
): IssueRepository => ({
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
  findRelatedOpenPRs: async (url: string): Promise<RelatedPullRequest[]> =>
    url === CONSOLE_E2E_INLINE_COMMENT_ISSUE_URL
      ? [inlineCommentRelatedPullRequest]
      : [],
  getOpenPullRequest: async (
    url: string,
  ): Promise<RelatedPullRequest | null> =>
    url === CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL
      ? awaitingQualityCheckPullRequest
      : null,
  getPullRequestChangedFilePaths: async (): Promise<string[]> => [],
  approvePullRequest: async (): Promise<void> => undefined,
  requestChangesWithInlineComment: async (): Promise<void> => undefined,
  createPullRequestReviewComment: async (
    prUrl: string,
    filePath: string,
    line: number,
    side: string,
    commentBody: string,
  ): Promise<void> => {
    reviewCommentCalls.push({
      url: prUrl,
      path: filePath,
      line,
      side,
      body: commentBody,
    });
  },
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
  getPullRequestDetail: async (
    url: string,
  ): Promise<PullRequestDetail | null> =>
    url === CONSOLE_E2E_INLINE_COMMENT_PR_URL
      ? inlineCommentPullRequestDetail
      : null,
  getPullRequestCommits: async (): Promise<PullRequestCommit[]> => [],
  getIssueOrPullRequestState: async (
    url: string,
  ): Promise<{ state: string; merged: boolean; isPullRequest: boolean }> => ({
    state: 'open',
    merged: false,
    isPullRequest: url.includes('/pull/'),
  }),
  getPullRequestSummary: async (
    url: string,
  ): Promise<{
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  } | null> =>
    url === CONSOLE_E2E_INLINE_COMMENT_PR_URL
      ? {
          title: 'Add inline review comments on the related pull request diff',
          body: 'Wires the add-comment handler on the related pull request diff path.',
          additions: 3,
          deletions: 1,
          changedFiles: 1,
        }
      : null,
});

export type ConsoleE2eHarness = {
  baseUrl: string;
  appUrl: string;
  appRootUrl: string;
  consoleDataOutputDir: string;
  reviewCommentCalls: ConsoleE2eReviewCommentCall[];
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

  const reviewCommentCalls: ConsoleE2eReviewCommentCall[] = [];

  const server = await startWebServer({
    accessToken: CONSOLE_E2E_TOKEN,
    uiDistDir,
    consoleDataOutputDir,
    issueRepository: createStubIssueRepository(reviewCommentCalls),
    resolveProject,
    issueTitleStateCache: new IssueTitleStateCache(),
    pullRequestStatusCache: new PullRequestStatusCache(),
    inTmuxDataDir: null,
    dashboardDir: null,
    dashboardDataDir: null,
    dashboardProjectNames: [],
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
    reviewCommentCalls,
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
