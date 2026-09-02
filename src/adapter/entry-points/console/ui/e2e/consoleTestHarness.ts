import * as fs from 'node:fs';
import type * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Issue } from '../../../../../domain/entities/Issue';
import type {
  FieldOption,
  Project,
} from '../../../../../domain/entities/Project';
import type { StoryObjectMap } from '../../../../../domain/entities/StoryObjectMap';
import type {
  IssueComment,
  IssueRepository,
  OpenPullRequestCiStatus,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  RelatedPullRequest,
} from '../../../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { ConsoleProjectBinding } from '../../consoleOperationApi';
import {
  deleteProjectTimer,
  writeProjectTimer,
} from '../../consoleProjectTimerStore';
import {
  IssueTitleStateCache,
  PullRequestStatusCache,
} from '../../consoleReadApi';
import { startWebServer } from '../../webServer';

export const CONSOLE_E2E_PJCODE = 'acme';
export const CONSOLE_E2E_TOKEN = 'console-e2e-fixture-token-3f9c1a';

export type ConsoleE2eReviewCommentCall = {
  url: string;
  path: string;
  line: number;
  side: string;
  body: string;
};

export type ConsoleE2eRequestChangesCall = {
  url: string;
  changedFilePath: string | null;
  body: string;
  inlineCommentLocation: { line: number; side: string } | null;
};

export type ConsoleE2eCreateIssueCall = {
  org: string;
  repo: string;
  title: string;
};

export type ConsoleE2eStoryColorCall = {
  storyOptionId: string;
  newColor: string;
};

export type ConsoleE2eCommentCall = {
  url: string;
  body: string;
};

export type ConsoleE2eDeleteAllCommentsCall = {
  issueUrl: string;
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
  agent: string | null;
  nextActionDate: string | null;
  nextActionHour: number | null;
  dependedIssueUrls: string[];
  labels: string[];
  createdAt: string;
  relatedOpenPullRequestUrls: string[];
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
  agentOptions: ConsoleFixtureFieldOption[];
  storyOptions: ConsoleFixtureFieldOption[];
  storyColors: Record<string, { color: string }>;
  storyOrder: string[];
  items: ConsoleFixtureListItem[];
};

const REPO_NAME_WITH_OWNER =
  'HiromiShikata/npm-cli-github-issue-tower-defence-management';

export const CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/pull/867`;
export const CONSOLE_E2E_INLINE_COMMENT_ISSUE_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/issues/911`;
export const CONSOLE_E2E_INLINE_COMMENT_PR_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/pull/912`;
export const CONSOLE_E2E_REFERENCE_LINK_URL = `https://github.com/${REPO_NAME_WITH_OWNER}/issues/845`;

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
  rawUrl: null,
};

const AWAITING_WORKSPACE_OPTION: ConsoleFixtureFieldOption = {
  id: 'd1c19cce',
  name: 'Awaiting Workspace',
  color: 'BLUE',
};

const STATUS_OPTIONS: ConsoleFixtureFieldOption[] = [
  AWAITING_WORKSPACE_OPTION,
  { id: 'f57f1ce9', name: 'Preparation', color: 'YELLOW' },
  { id: 'fd313492', name: 'Failed Preparation', color: 'RED' },
  { id: 'e9931e57', name: 'Todo by human', color: 'PINK' },
  { id: 'a1e4b7c9', name: 'Todo by agent', color: 'BLUE' },
  { id: 'c2d278b2', name: 'In Tmux by human', color: 'RED' },
  { id: 'e9f6a726', name: 'In Tmux by agent', color: 'YELLOW' },
];

const AGENT_OPTIONS: ConsoleFixtureFieldOption[] = [
  { id: 'agt00001', name: 'developer', color: 'BLUE' },
  { id: 'agt00002', name: 'chore', color: 'GRAY' },
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
  relatedOpenPullRequestUrls: [],
  story,
  status: null,
  agent: null,
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
  relatedOpenPullRequestUrls: [],
  story,
  status: null,
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: ['claude'],
  createdAt,
});

const buildSnapshot = (
  items: ConsoleFixtureListItem[],
  agentOptions: ConsoleFixtureFieldOption[] = [],
  storyOrder: string[] = [],
): ConsoleFixtureSnapshot => ({
  pjcode: CONSOLE_E2E_PJCODE,
  generatedAt: '2026-06-18T01:22:09.000Z',
  statusOptions: STATUS_OPTIONS,
  agentOptions,
  storyOptions: STORY_OPTIONS,
  storyColors: STORY_COLORS,
  storyOrder,
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
    {
      ...pullRequestItem(
        867,
        'Serve the committed console UI bundle from serveConsole',
        'PRS00867',
        'TDPM Console port',
        '2026-06-17T23:41:08.000Z',
      ),
      agent: 'developer',
    },
    {
      ...pullRequestItem(
        868,
        'Clean up stale console UI test fixtures',
        'PRS00868',
        'TDPM Console port',
        '2026-06-17T23:55:00.000Z',
      ),
      agent: 'chore',
    },
  ],
  'failed-preparation': [
    {
      ...issueItem(
        911,
        'Add inline review comments on the related pull request diff',
        'FPR00911',
        'TDPM Console port',
        '2026-06-18T03:12:00.000Z',
      ),
      relatedOpenPullRequestUrls: [CONSOLE_E2E_INLINE_COMMENT_PR_URL],
    },
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
  'todo-by-agent': [
    {
      ...issueItem(
        871,
        'Route console items into the Todo by agent manual triage bucket',
        'TDAG00871',
        'TDPM Console port',
        '2026-06-18T00:41:27.000Z',
      ),
      agent: 'developer',
    },
    {
      ...issueItem(
        870,
        'Publish product documentation site story issue',
        'TDAG00870',
        'Publish product documentation site',
        '2026-06-18T00:30:00.000Z',
      ),
      labels: ['story'],
    },
  ],
  queued: [
    {
      ...issueItem(
        930,
        'Add telemetry to the TDPM cost dashboard',
        'QUE00930',
        'TDPM Console port',
        '2026-06-18T02:00:00.000Z',
      ),
      status: 'Awaiting Workspace',
    },
    {
      ...issueItem(
        931,
        'Migrate the rate-limit store to a shared Redis backend',
        'QUE00931',
        'regular / workflow improvement',
        '2026-06-18T02:30:00.000Z',
      ),
      status: 'Preparation',
      agent: 'developer',
    },
  ],
};

const CONSOLE_E2E_STORIES_SNAPSHOT = {
  pjcode: CONSOLE_E2E_PJCODE,
  generatedAt: '2026-06-18T01:22:09.000Z',
  stories: [
    {
      storyName: 'TDPM Console port',
      storyOptionId: '1491051e',
      color: 'BLUE',
      openItemCount: 4,
      storyViewUrl:
        'https://github.com/orgs/HiromiShikata/projects/6/views/1?sliceBy%5Bvalue%5D=TDPM%20Console%20port',
    },
    {
      storyName: 'regular / workflow improvement',
      storyOptionId: '28415d6c',
      color: 'GRAY',
      openItemCount: 1,
      storyViewUrl: null,
    },
    {
      storyName: 'Publish product documentation site',
      storyOptionId: 'f7cd5cbc',
      color: 'GREEN',
      openItemCount: 1,
      storyViewUrl: null,
    },
    {
      storyName: 'regular / WORKFLOW BLOCKER',
      storyOptionId: 'a3b9c4d2',
      color: 'RED',
      openItemCount: 1,
    },
  ],
  storyOrder: [
    'TDPM Console port',
    'regular / workflow improvement',
    'Publish product documentation site',
    'regular / WORKFLOW BLOCKER',
  ],
  storyColors: STORY_COLORS,
  defaultNameWithOwner: REPO_NAME_WITH_OWNER,
};

const QUEUED_STORY_ORDER = [
  'TDPM Console port',
  'regular / workflow improvement',
];

const writeFixtureData = (consoleDataOutputDir: string): void => {
  for (const [tab, items] of Object.entries(CONSOLE_E2E_TAB_ITEMS)) {
    const tabDir = path.join(consoleDataOutputDir, CONSOLE_E2E_PJCODE, tab);
    fs.mkdirSync(tabDir, { recursive: true });
    const agentOptions = tab === 'queued' || tab === 'prs' ? AGENT_OPTIONS : [];
    const storyOrder = tab === 'queued' ? QUEUED_STORY_ORDER : [];
    fs.writeFileSync(
      path.join(tabDir, 'list.json'),
      JSON.stringify(buildSnapshot(items, agentOptions, storyOrder)),
    );
  }
  const storiesTabDir = path.join(
    consoleDataOutputDir,
    CONSOLE_E2E_PJCODE,
    'stories',
  );
  fs.mkdirSync(storiesTabDir, { recursive: true });
  fs.writeFileSync(
    path.join(storiesTabDir, 'list.json'),
    JSON.stringify(CONSOLE_E2E_STORIES_SNAPSHOT),
  );
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
  nextActionHour: {
    name: 'Next Action Hour',
    fieldId: 'PVTF_nah',
    options: [],
  },
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
  agent: {
    name: 'Agent',
    fieldId: 'PVTSSF_agent',
    options: AGENT_OPTIONS.map((option) => ({
      id: option.id,
      name: option.name,
      color: option.color as Project['status']['statuses'][number]['color'],
      description: '',
    })),
  },
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
  agent: null,
  stateReason: null,
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

const awaitingQualityCheckPullRequestMergeReady: RelatedPullRequest = {
  ...awaitingQualityCheckPullRequest,
  isConflicted: false,
  mergeable: 'MERGEABLE',
  isPassedAllCiJob: true,
  isCiStateSuccess: true,
  isBranchOutOfDate: false,
  missingRequiredCheckNames: [],
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
  requestChangesCalls: ConsoleE2eRequestChangesCall[],
  createIssueCalls: ConsoleE2eCreateIssueCall[],
  storyColorCalls: ConsoleE2eStoryColorCall[],
  commentCalls: ConsoleE2eCommentCall[],
  deleteAllCommentsCalls: ConsoleE2eDeleteAllCommentsCall[],
  closeIssueCalls: string[],
): IssueRepository => ({
  getAllIssues: () => notImplemented('getAllIssues'),
  getIssueByUrl: async (url: string): Promise<Issue | null> =>
    buildIssueForUrl(url),
  getIssueBodyByUrl: async (url: string): Promise<string | null> =>
    buildIssueForUrl(url)?.body ?? null,
  createNewIssue: async (
    org: string,
    repo: string,
    title: string,
  ): Promise<number> => {
    createIssueCalls.push({ org, repo, title });
    return 9001;
  },
  searchIssue: () => notImplemented('searchIssue'),
  updateIssue: async (): Promise<void> => undefined,
  updateIssueBody: () => notImplemented('updateIssueBody'),
  updateNextActionDate: async (): Promise<void> => undefined,
  updateNextActionHour: () => notImplemented('updateNextActionHour'),
  updateProjectTextField: () => notImplemented('updateProjectTextField'),
  updateStory: async (): Promise<void> => undefined,
  updateStatus: async (): Promise<void> => undefined,
  clearProjectField: () => notImplemented('clearProjectField'),
  createComment: () => notImplemented('createComment'),
  updateLabels: () => notImplemented('updateLabels'),
  removeLabel: () => notImplemented('removeLabel'),
  getOrCreateLabel: () => notImplemented('getOrCreateLabel'),
  updateAssigneeList: () => notImplemented('updateAssigneeList'),
  searchIssues: () => notImplemented('searchIssues'),
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
      ? awaitingQualityCheckPullRequestMergeReady
      : null,
  getOpenPullRequestCiStatus: async (
    url: string,
  ): Promise<OpenPullRequestCiStatus | null> =>
    url === CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL
      ? {
          url: awaitingQualityCheckPullRequest.url,
          branchName: awaitingQualityCheckPullRequest.branchName,
          createdAt: awaitingQualityCheckPullRequest.createdAt.toISOString(),
          isDraft: awaitingQualityCheckPullRequest.isDraft,
          isConflicted: awaitingQualityCheckPullRequest.isConflicted,
          mergeable: awaitingQualityCheckPullRequest.mergeable,
          isPassedAllCiJob: awaitingQualityCheckPullRequest.isPassedAllCiJob,
          isCiStateSuccess: awaitingQualityCheckPullRequest.isCiStateSuccess,
          isBranchOutOfDate: awaitingQualityCheckPullRequest.isBranchOutOfDate,
          missingRequiredCheckNames:
            awaitingQualityCheckPullRequest.missingRequiredCheckNames,
        }
      : null,
  getOpenPullRequests: async (
    urls: string[],
  ): Promise<Map<string, RelatedPullRequest | null>> =>
    new Map(
      urls.map((url) => [
        url,
        url === CONSOLE_E2E_AWAITING_QUALITY_CHECK_PR_URL
          ? awaitingQualityCheckPullRequest
          : null,
      ]),
    ),
  getPullRequestChangedFilePaths: async (): Promise<string[]> => [],
  getAuthenticatedUserLogin: async (): Promise<string> => 'test-user',
  approvePullRequest: async (): Promise<void> => undefined,
  mergePullRequest: async (): Promise<void> => undefined,
  requestChangesWithInlineComment: async (
    prUrl: string,
    changedFilePath: string | null,
    commentBody: string,
    inlineCommentLocation?: { line: number; side: string } | null,
  ): Promise<void> => {
    requestChangesCalls.push({
      url: prUrl,
      changedFilePath,
      body: commentBody,
      inlineCommentLocation: inlineCommentLocation ?? null,
    });
  },
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
  closeIssueByUrl: async (url: string): Promise<void> => {
    closeIssueCalls.push(url);
  },
  deletePullRequestBranch: () => notImplemented('deletePullRequestBranch'),
  createCommentByUrl: async (
    url: string,
    body: string,
  ): Promise<IssueComment> => {
    commentCalls.push({ url, body });
    return { author: '', body, createdAt: new Date(0) };
  },
  getAllOpened: () => notImplemented('getAllOpened'),
  getStoryObjectMap: async (project): Promise<StoryObjectMap> => {
    const map: StoryObjectMap = new Map();
    for (const story of project.story?.stories ?? []) {
      map.set(story.name, {
        story,
        storyIssue: {
          nameWithOwner: 'example/example',
          number: 0,
          title: story.name,
          state: 'OPEN',
          status: null,
          story: null,
          nextActionDate: null,
          nextActionHour: null,
          estimationMinutes: null,
          dependedIssueUrls: [],
          completionDate50PercentConfidence: null,
          url: `https://github.com/example/example/issues/${story.id}`,
          assignees: [],
          labels: [],
          org: 'example',
          repo: 'example',
          body: '',
          itemId: '',
          isPr: false,
          isInProgress: false,
          isClosed: false,
          createdAt: new Date(0),
          author: '',
          closingIssueReferenceUrls: [],
          agent: null,
          stateReason: null,
        },
        issues: [],
      });
    }
    return map;
  },
  addIssueToProject: async (): Promise<void> => undefined,
  setDependedIssueUrl: () => notImplemented('setDependedIssueUrl'),
  getIssueOrPullRequestBody: async (): Promise<string> =>
    [
      '## Console E2E fixture',
      '',
      'This body is served by the isolated E2E stub.',
      '',
      `See also ${CONSOLE_E2E_REFERENCE_LINK_URL} for the reference.`,
      '',
      ...Array.from(
        { length: 80 },
        (_, index) => `Description line ${index + 1} of the fixture body.`,
      ),
    ].join('\n'),
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
  ): Promise<{
    state: string;
    merged: boolean;
    isPullRequest: boolean;
    title: string;
  }> => ({
    state: 'open',
    merged: false,
    isPullRequest: url.includes('/pull/'),
    title:
      url === CONSOLE_E2E_INLINE_COMMENT_PR_URL
        ? 'Add inline review comments on the related pull request diff'
        : buildIssueForUrl(url).title,
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
  setIssueAgentField: async (): Promise<void> => undefined,
  updateBranch: async (): Promise<boolean> => false,
  updateStoryOptionColor: async (
    _project,
    storyOptionId: string,
    newColor: string,
  ): Promise<void> => {
    storyColorCalls.push({ storyOptionId, newColor });
  },
  deleteAllCommentsByUrl: async (issueUrl: string): Promise<void> => {
    deleteAllCommentsCalls.push({ issueUrl });
  },
});

export type ConsoleE2eReorderStoryCall = {
  storyOptionIds: string[];
};

export type ConsoleE2eAddStoryCall = {
  storyName: string;
};

export type ConsoleE2eDeleteStoryCall = {
  storyOptionId: string;
};

export type ConsoleE2eRenameStoryCall = {
  storyOptionId: string;
  newName: string;
};

export type ConsoleE2eHarness = {
  baseUrl: string;
  appUrl: string;
  appRootUrl: string;
  consoleDataOutputDir: string;
  reviewCommentCalls: ConsoleE2eReviewCommentCall[];
  requestChangesCalls: ConsoleE2eRequestChangesCall[];
  createIssueCalls: ConsoleE2eCreateIssueCall[];
  commentCalls: ConsoleE2eCommentCall[];
  reorderStoryCalls: ConsoleE2eReorderStoryCall[];
  addStoryCalls: ConsoleE2eAddStoryCall[];
  deleteStoryCalls: ConsoleE2eDeleteStoryCall[];
  renameStoryCalls: ConsoleE2eRenameStoryCall[];
  closeIssueCalls: string[];
  storyColorCalls: ConsoleE2eStoryColorCall[];
  deleteAllCommentsCalls: ConsoleE2eDeleteAllCommentsCall[];
  setProjectTimer: (durationSeconds: number) => void;
  expireProjectTimer: () => void;
  clearProjectTimer: () => void;
  stop: () => Promise<void>;
};

export const startConsoleE2eHarness = async (options?: {
  workflowImprovementIssueUrl?: string | null;
}): Promise<ConsoleE2eHarness> => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'console-e2e-'));
  const consoleDataOutputDir = path.join(tmpRoot, 'data');
  writeFixtureData(consoleDataOutputDir);

  const uiDistDir = path.resolve(__dirname, '..', '..', 'ui-dist');

  const project = buildE2eProject();
  const resolveProject = async (
    pjcode: string,
  ): Promise<ConsoleProjectBinding | null> =>
    pjcode === CONSOLE_E2E_PJCODE ? { pjcode, project } : null;
  const isPjcodeConfigured = (pjcode: string): boolean =>
    pjcode === CONSOLE_E2E_PJCODE;

  const reviewCommentCalls: ConsoleE2eReviewCommentCall[] = [];
  const requestChangesCalls: ConsoleE2eRequestChangesCall[] = [];
  const createIssueCalls: ConsoleE2eCreateIssueCall[] = [];
  const commentCalls: ConsoleE2eCommentCall[] = [];
  const reorderStoryCalls: ConsoleE2eReorderStoryCall[] = [];
  const addStoryCalls: ConsoleE2eAddStoryCall[] = [];
  const deleteStoryCalls: ConsoleE2eDeleteStoryCall[] = [];
  const renameStoryCalls: ConsoleE2eRenameStoryCall[] = [];
  const closeIssueCalls: string[] = [];
  const storyColorCalls: ConsoleE2eStoryColorCall[] = [];
  const deleteAllCommentsCalls: ConsoleE2eDeleteAllCommentsCall[] = [];

  const server = await startWebServer({
    accessToken: CONSOLE_E2E_TOKEN,
    uiDistDir,
    consoleDataOutputDir,
    issueRepository: createStubIssueRepository(
      reviewCommentCalls,
      requestChangesCalls,
      createIssueCalls,
      storyColorCalls,
      commentCalls,
      deleteAllCommentsCalls,
      closeIssueCalls,
    ),
    resolveProjectRepository: (_projectUrl) => ({
      updateStoryList: async (_updatedProject, stories) => {
        const currentStories = project.story?.stories ?? [];
        const currentCount = currentStories.length;
        if (stories.length > currentCount) {
          const newStory = stories.find((s) => s.id === null);
          if (newStory !== undefined) {
            addStoryCalls.push({ storyName: newStory.name });
          }
        } else if (stories.length < currentCount) {
          const deleted = currentStories.find(
            (s) => !stories.some((ns) => ns.id === s.id),
          );
          if (deleted !== undefined && deleted.id !== null) {
            deleteStoryCalls.push({ storyOptionId: deleted.id });
          }
        } else {
          const isRename =
            stories.every((s, i) => s.id === currentStories[i]?.id) &&
            stories.some((s, i) => s.name !== currentStories[i]?.name);
          if (isRename) {
            const changed = stories.find(
              (s, i) => s.name !== currentStories[i]?.name,
            );
            if (changed !== undefined && changed.id !== null) {
              renameStoryCalls.push({
                storyOptionId: changed.id,
                newName: changed.name,
              });
            }
          } else {
            reorderStoryCalls.push({
              storyOptionIds: stories
                .map((s) => s.id)
                .filter((id): id is string => id !== null),
            });
          }
        }
        const result = stories as FieldOption[];
        if (project.story !== null) {
          project.story.stories = result;
        }
        return result;
      },
    }),
    resolveProject,
    isPjcodeConfigured,
    issueTitleStateCache: new IssueTitleStateCache(),
    pullRequestStatusCache: new PullRequestStatusCache(),
    inTmuxDataDir: null,
    dashboardDir: null,
    dashboardDataDir: null,
    dashboardProjectNames: [],
    workflowImprovementIssueUrl: options?.workflowImprovementIssueUrl ?? null,
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
    requestChangesCalls,
    createIssueCalls,
    commentCalls,
    reorderStoryCalls,
    addStoryCalls,
    deleteStoryCalls,
    renameStoryCalls,
    closeIssueCalls,
    storyColorCalls,
    deleteAllCommentsCalls,
    setProjectTimer: (durationSeconds: number): void => {
      writeProjectTimer(consoleDataOutputDir, CONSOLE_E2E_PJCODE, {
        startedAt: new Date().toISOString(),
        durationSeconds,
      });
    },
    expireProjectTimer: (): void => {
      writeProjectTimer(consoleDataOutputDir, CONSOLE_E2E_PJCODE, {
        startedAt: new Date(Date.now() - 5000).toISOString(),
        durationSeconds: 1,
      });
    },
    clearProjectTimer: (): void => {
      deleteProjectTimer(consoleDataOutputDir, CONSOLE_E2E_PJCODE);
    },
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
