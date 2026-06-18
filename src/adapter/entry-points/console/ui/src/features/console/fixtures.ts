import type {
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleItemBody,
  ConsoleListItem,
  ConsolePullRequestDetail,
  ConsoleRelatedPullRequest,
  ConsoleStatusTab,
  ConsoleTriageTab,
} from './types';

const REPO = 'HiromiShikata/npm-cli-github-issue-tower-defence-management';

export const consoleListItemsFixture: ConsoleListItem[] = [
  {
    number: 851,
    title:
      'feat(console): serveConsole data delivery, read APIs, and operation APIs',
    url: `https://github.com/${REPO}/pull/851`,
    repo: REPO,
    nameWithOwner: REPO,
    projectItemId: 'PVTI_lADOABCD1234zgABCD01',
    itemId: 'PVTI_lADOABCD1234zgABCD01',
    isPr: true,
    story: 'TDPM Console port',
    labels: ['claude'],
    createdAt: '2026-06-17T02:14:33.000Z',
    state: 'open',
    stateReason: '',
  },
  {
    number: 852,
    title:
      'feat(console): React UI feature parity for detail view, operations, Mermaid, and list features',
    url: `https://github.com/${REPO}/issues/852`,
    repo: REPO,
    nameWithOwner: REPO,
    projectItemId: 'PVTI_lADOABCD1234zgABCD02',
    itemId: 'PVTI_lADOABCD1234zgABCD02',
    isPr: false,
    story: 'TDPM Console port',
    labels: ['claude'],
    createdAt: '2026-06-18T05:48:09.000Z',
    state: 'open',
    stateReason: '',
  },
  {
    number: 778,
    title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    url: `https://github.com/${REPO}/issues/778`,
    repo: REPO,
    nameWithOwner: REPO,
    projectItemId: 'PVTI_lADOABCD1234zgABCD03',
    itemId: 'PVTI_lADOABCD1234zgABCD03',
    isPr: false,
    story: 'regular / workflow improvement',
    labels: [],
    createdAt: '2026-06-12T23:01:55.000Z',
    state: 'open',
    stateReason: '',
  },
  {
    number: 803,
    title: 'Reduce GraphQL round trips in story object map generation',
    url: `https://github.com/${REPO}/issues/803`,
    repo: REPO,
    nameWithOwner: REPO,
    projectItemId: 'PVTI_lADOABCD1234zgABCD04',
    itemId: 'PVTI_lADOABCD1234zgABCD04',
    isPr: false,
    story: 'regular / workflow improvement',
    labels: ['claude'],
    createdAt: '2026-06-14T11:09:41.000Z',
    state: 'open',
    stateReason: '',
  },
];

export const consoleStatusOptionsFixture: ConsoleFieldOption[] = [
  { id: 'STATUS_OPT_IN_TMUX_AGENT', name: 'In Tmux by agent', color: 'BLUE' },
  { id: 'STATUS_OPT_IN_TMUX_HUMAN', name: 'In Tmux by human', color: 'PURPLE' },
  { id: 'STATUS_OPT_TODO_HUMAN', name: 'Todo by human', color: 'YELLOW' },
  { id: 'STATUS_OPT_AWAITING_WS', name: 'Awaiting Workspace', color: 'GREEN' },
];

export const consoleStoryOptionsFixture: ConsoleFieldOption[] = [
  { id: 'STORY_OPT_NO_STORY', name: 'No story', color: 'GRAY' },
  { id: 'STORY_OPT_CONSOLE_PORT', name: 'TDPM Console port', color: 'BLUE' },
  {
    id: 'STORY_OPT_WORKFLOW',
    name: 'regular / workflow improvement',
    color: 'GREEN',
  },
];

export const consoleStatusTabFixture: ConsoleStatusTab = {
  pjcode: 'tdpm',
  generatedAt: '2026-06-18T05:50:00.000Z',
  statusOptions: consoleStatusOptionsFixture,
  storyOrder: ['TDPM Console port', 'regular / workflow improvement'],
  storyColors: {
    'TDPM Console port': { color: 'BLUE' },
    'regular / workflow improvement': { color: 'GREEN' },
  },
  items: consoleListItemsFixture,
};

export const consoleTriageTabFixture: ConsoleTriageTab = {
  pjcode: 'tdpm',
  generatedAt: '2026-06-18T05:50:00.000Z',
  storyOptions: consoleStoryOptionsFixture,
  storyOrder: ['TDPM Console port', 'regular / workflow improvement'],
  storyColors: {
    'TDPM Console port': 'BLUE',
    'regular / workflow improvement': 'GREEN',
  },
  items: consoleListItemsFixture,
};

export const consoleCommentsFixture: ConsoleComment[] = [
  {
    author: 'HiromiShikata',
    body: 'Please keep the operation bar group ordering identical to the prototype so muscle memory carries over.',
    createdAt: '2026-06-17T09:12:04.000Z',
  },
  {
    author: 'claude',
    body: 'Confirmed. The vertical order is PR review, Next Action Date, Story, Status, then Close, matching the prototype renderActionBar builders.',
    createdAt: '2026-06-17T09:41:55.000Z',
  },
];

export const consoleMarkdownBodyFixture = [
  '## Summary',
  '',
  'Render the item body as Markdown via marked and sanitize the output with DOMPurify before inserting it into the DOM.',
  '',
  '- GitHub Flavored Markdown is enabled.',
  '- Soft line breaks are converted to line break tags.',
  '',
  '```ts',
  'const html = DOMPurify.sanitize(marked.parse(source));',
  '```',
  '',
  'See https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management for context.',
].join('\n');

export const consoleMermaidBodyFixture = [
  '## Data flow',
  '',
  '```mermaid',
  'graph TD',
  '  ListJson[list.json] --> UseConsoleList[useConsoleList hook]',
  '  UseConsoleList --> ConsoleListView[ConsoleListView]',
  '  ConsoleListView --> ConsoleItemDetail[ConsoleItemDetail]',
  '  ConsoleItemDetail --> MarkdownView[MarkdownView]',
  '  ConsoleItemDetail --> PullRequestSection[PullRequestSection]',
  '```',
].join('\n');

export const consoleMermaidDiagramFixture = [
  'sequenceDiagram',
  '  participant User',
  '  participant Console',
  '  participant Server',
  '  User->>Console: Open Awaiting Quality Check item',
  '  Console->>Server: GET /api/itembody',
  '  Server-->>Console: body, comments, state',
  '  Console-->>User: Render Markdown and lazy comments',
].join('\n');

export const consoleItemBodyFixture: ConsoleItemBody = {
  body: consoleMermaidBodyFixture,
  labels: ['claude'],
  createdAt: '2026-06-18T05:48:09.000Z',
  comments: consoleCommentsFixture,
  state: 'open',
  stateReason: '',
};

export const consolePullRequestDetailFixture: ConsolePullRequestDetail = {
  title:
    'feat(console): serveConsole data delivery, read APIs, and operation APIs',
  body: [
    'Implements the serveConsole data delivery layer and the read and operation APIs.',
    '',
    'Closes #850',
  ].join('\n'),
  state: 'open',
  merged: false,
  isDraft: false,
  additions: 642,
  deletions: 73,
  changedFiles: 9,
  headRefName: 'feature/850-serveconsole-data-and-apis',
  baseRefName: 'main',
  author: 'HiromiShikata',
  files: [
    {
      filename: 'src/adapter/entry-points/console/consoleServer.ts',
      status: 'modified',
      additions: 318,
      deletions: 41,
      patch: [
        '@@ -120,6 +120,24 @@ const handleApiRequest = (',
        "+  if (pathname === '/api/itembody') {",
        '+    const body = await issueRepository.getIssueOrPullRequestBody(url);',
        '+    return jsonResponse({ ok: true, body });',
        '+  }',
      ].join('\n'),
    },
    {
      filename: 'src/adapter/entry-points/console/consoleServer.test.ts',
      status: 'modified',
      additions: 211,
      deletions: 12,
      patch: null,
    },
    {
      filename:
        'src/adapter/repositories/issue/ApiV3CheerioRestIssueRepository.ts',
      status: 'modified',
      additions: 113,
      deletions: 20,
      patch: [
        '@@ -480,6 +480,18 @@ export class ApiV3CheerioRestIssueRepository {',
        '+  getPullRequestCommits = async (',
        '+    prUrl: string,',
        '+  ): Promise<PullRequestCommit[]> => {',
        '+    const { owner, repo, number } = parsePrUrl(prUrl);',
        '+    return this.fetchCommits(owner, repo, number);',
        '+  };',
      ].join('\n'),
    },
  ],
  commits: [
    {
      sha: '8f2c1ab4e9d7c0b3a6f5e2d1c4b7a8f9e0d3c2b1',
      message: 'feat(console): add /api/itembody and /api/comments endpoints',
      author: 'HiromiShikata',
      authoredAt: '2026-06-17T03:21:48.000Z',
    },
    {
      sha: '1d4e7a2b5c8f0e3d6a9c2b5e8f1a4d7c0b3e6f9a',
      message: 'feat(console): add /api/prfiles and /api/prcommits endpoints',
      author: 'HiromiShikata',
      authoredAt: '2026-06-17T04:08:12.000Z',
    },
    {
      sha: '2e5f8b3c6d9a1f4e7b0c3d6a9f2e5b8c1d4a7e0b',
      message: 'test(console): cover read APIs with token-gate cases',
      author: 'HiromiShikata',
      authoredAt: '2026-06-17T05:02:30.000Z',
    },
  ],
};

export const consoleRelatedPullRequestsFixture: ConsoleRelatedPullRequest[] = [
  {
    url: `https://github.com/${REPO}/pull/851`,
    repo: REPO,
    number: 851,
    title:
      'feat(console): serveConsole data delivery, read APIs, and operation APIs',
    isDraft: false,
  },
];
