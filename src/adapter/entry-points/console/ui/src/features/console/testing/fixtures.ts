import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleFieldOption,
  ConsoleIssueState,
  ConsoleListItem,
  ConsoleRelatedPullRequest,
  ConsoleStoryColorSource,
} from '../logic/types';

export const consoleStatusOptionsFixture: ConsoleFieldOption[] = [
  { id: 'f75ad846', name: 'Unread', color: 'ORANGE' },
  { id: 'd1c19cce', name: 'Awaiting Workspace', color: 'BLUE' },
  { id: 'f57f1ce9', name: 'Preparation', color: 'YELLOW' },
  { id: 'fd313492', name: 'Failed Preparation', color: 'RED' },
  { id: 'e9931e57', name: 'Todo by human', color: 'PINK' },
  { id: 'c2d278b2', name: 'In Tmux by human', color: 'RED' },
  { id: 'e9f6a726', name: 'In Tmux by agent', color: 'YELLOW' },
  { id: 'bd8358eb', name: 'Icebox', color: 'GRAY' },
];

export const consoleStoryOptionsFixture: ConsoleFieldOption[] = [
  { id: '28415d6c', name: 'regular / workflow improvement', color: 'GRAY' },
  { id: '1491051e', name: 'TDPM Console port', color: 'BLUE' },
  { id: 'e35b3da2', name: 'regular / WORKFLOW BLOCKER', color: 'RED' },
  {
    id: 'd7cdcb61',
    name: 'regular / regular payment invoice tax',
    color: 'YELLOW',
  },
  {
    id: 'f7cd5cbc',
    name: 'Publish product documentation site',
    color: 'GREEN',
  },
  { id: '564803ee', name: 'Move to Okinawa', color: 'PURPLE' },
];

export const consoleStoryColorsFixture: ConsoleStoryColorSource = {
  'TDPM Console port': { color: 'BLUE' },
  'regular / workflow improvement': { color: 'GRAY' },
  'Publish product documentation site': { color: 'GREEN' },
  'Move to Okinawa': { color: 'PURPLE' },
};

export const consoleListItemsFixture: ConsoleListItem[] = [
  {
    number: 851,
    title: 'Add serveConsole subcommand under entry-points',
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851',
    repo: 'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    nameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    projectItemId: 'PVTI_lADOABCD1234zgABCD01',
    itemId: 'PVTI_lADOABCD1234zgABCD01',
    isPr: true,
    story: 'TDPM Console port',
    status: 'Awaiting Quality Check',
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
    ],
    labels: ['claude'],
    createdAt: '2026-06-17T02:14:33.000Z',
  },
  {
    number: 853,
    title:
      'Add server-side console API handlers for read and operation endpoints',
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/853',
    repo: 'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    nameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    projectItemId: 'PVTI_lADOABCD1234zgABCD02',
    itemId: 'PVTI_lADOABCD1234zgABCD02',
    isPr: true,
    story: 'TDPM Console port',
    status: 'Preparation',
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: ['claude'],
    createdAt: '2026-06-17T05:48:09.000Z',
  },
  {
    number: 845,
    title: 'Scaffold React console UI under entry-points with build bundling',
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845',
    repo: 'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    nameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    projectItemId: 'PVTI_lADOABCD1234zgABCD03',
    itemId: 'PVTI_lADOABCD1234zgABCD03',
    isPr: false,
    story: 'TDPM Console port',
    status: 'Todo by human',
    nextActionDate: '2026-06-20T07:00:00.000Z',
    nextActionHour: 9,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-06-16T22:01:55.000Z',
  },
  {
    number: 778,
    title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/778',
    repo: 'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    nameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    projectItemId: 'PVTI_lADOABCD1234zgABCD04',
    itemId: 'PVTI_lADOABCD1234zgABCD04',
    isPr: false,
    story: 'regular / workflow improvement',
    status: null,
    nextActionDate: null,
    nextActionHour: 14,
    dependedIssueUrls: [],
    labels: [],
    createdAt: '2026-06-12T23:01:55.000Z',
  },
  {
    number: 692,
    title: 'Publish the generated documentation site to GitHub Pages',
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/692',
    repo: 'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    nameWithOwner:
      'HiromiShikata/npm-cli-github-issue-tower-defence-management',
    projectItemId: 'PVTI_lADOABCD1234zgABCD05',
    itemId: 'PVTI_lADOABCD1234zgABCD05',
    isPr: false,
    story: 'Publish product documentation site',
    status: 'Icebox',
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: ['documentation'],
    createdAt: '2026-06-10T11:42:00.000Z',
  },
];

export const consoleMarkdownBodyFixture = `## Summary

This pull request adds the \`serveConsole\` subcommand that serves the static
console bundle and the token-protected \`/api\` endpoints.

- Adds an HTTP server bound to port 9981 by default
- Serves \`list.json\` per tab and the read APIs by \`url\`
- Records acted-on items into a cross-tab done store

### Checklist

- [x] Unit tests for the data delivery routing
- [x] Token validation via \`?k=\` and the \`x-pv-token\` header
`;

export const consoleMarkdownImageBodyFixture = `## Screenshot

The failing screen is attached below.

![console screenshot](https://github.com/user-attachments/assets/0a1b2c3d-4e5f-6789-abcd-ef0123456789)

For reference, the avatar comes from an external host:

![external avatar](https://example.com/avatar.png)
`;

export const consoleCodeFenceBodyFixture = `## Reproduction

A TypeScript fenced code block MUST render as a styled code box rather than
literal backticks:

\`\`\`ts
export const splitMarkdownSegments = (source: string): ConsoleMarkdownSegment[] => {
  const lines = source.split('\\n');
  return lines.length > 0 ? parse(lines) : [];
};
\`\`\`

A code block that documents a mermaid fence MUST stay literal text and MUST NOT
be turned into a diagram:

\`\`\`text
\`\`\`mermaid
graph TD; A-->B;
\`\`\`

The diagram below MUST still render as an actual diagram:

\`\`\`mermaid
sequenceDiagram
  participant Browser
  participant ConsoleServer
  Browser->>ConsoleServer: GET /api/itembody?url=...
  ConsoleServer-->>Browser: { body }
\`\`\`

Inline \`code\` spans are unaffected.
`;

export const consoleMermaidBodyFixture = `Here is the request flow:

\`\`\`mermaid
sequenceDiagram
  participant Browser
  participant ConsoleServer
  participant IssueRepository
  Browser->>ConsoleServer: GET /api/itembody?url=...
  ConsoleServer->>IssueRepository: getIssueOrPullRequestBody(url)
  IssueRepository-->>ConsoleServer: body markdown
  ConsoleServer-->>Browser: { body }
\`\`\`

The diagram above is rendered lazily.
`;

export const consoleMermaidCodeFixture = `sequenceDiagram
  participant Browser
  participant ConsoleServer
  participant IssueRepository
  Browser->>ConsoleServer: GET /api/itembody?url=...
  ConsoleServer->>IssueRepository: getIssueOrPullRequestBody(url)
  IssueRepository-->>ConsoleServer: body markdown
  ConsoleServer-->>Browser: { body }`;

export const consoleCommentsFixture: ConsoleComment[] = [
  {
    author: 'HiromiShikata',
    body: 'Please split the token validation into its own tested function.',
    createdAt: '2026-06-17T06:12:40.000Z',
  },
  {
    author: 'github-actions',
    body: 'All required checks have passed on this pull request.',
    createdAt: '2026-06-17T07:48:11.000Z',
  },
  {
    author: 'HiromiShikata',
    body: 'Looks good now. Approving once the rebase is green.',
    createdAt: '2026-06-17T09:03:27.000Z',
  },
];

export const consoleChangedFilesFixture: ConsoleChangedFile[] = [
  {
    path: 'src/adapter/entry-points/console/consoleServer.ts',
    additions: 312,
    deletions: 4,
    status: 'added',
    patch: `@@ -54,7 +54,12 @@ export const serveConsole = (
           loose-matching: true
       - name: Install dependencies
         run: |
-          npm install
+          npm ci
+          npm run build:console-ui
       - name: Start the token-protected console server
         run: node bin/serveConsole.js --port 9981`,
  },
  {
    path: 'src/adapter/entry-points/console/consoleServer.test.ts',
    additions: 268,
    deletions: 0,
    status: 'added',
    patch: `@@ -0,0 +1,4 @@
+describe('serveConsole', () => {
+  it('rejects a request without a valid token', async () => {
+  });
+});`,
  },
  {
    path: 'package.json',
    additions: 6,
    deletions: 1,
    status: 'modified',
    patch: `@@ -12,7 +12,7 @@
   "scripts": {
-    "build": "tsc -p ./tsconfig.build.json"
+    "build": "tsc -p ./tsconfig.build.json && npm run build:console-ui"
   },`,
  },
];

export const consoleCommitsFixture: ConsoleCommit[] = [
  {
    sha: '4f9c2a1b6d8e0f3a7c5b9d1e2f4a6c8b0d2e4f6a',
    message: 'feat(console): add serveConsole subcommand and HTTP server',
    author: 'HiromiShikata',
    authoredAt: '2026-06-17T02:10:11.000Z',
  },
  {
    sha: '8b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d',
    message: 'test(console): cover token validation and data routing',
    author: 'HiromiShikata',
    authoredAt: '2026-06-17T05:41:52.000Z',
  },
];

export const consoleRelatedPullRequestsFixture: ConsoleRelatedPullRequest[] = [
  {
    url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/849',
    branchName: 'feature/849-react-console-scaffold',
    createdAt: '2026-06-16T22:30:00.000Z',
    isDraft: false,
    isConflicted: false,
    isPassedAllCiJob: true,
    isCiStateSuccess: true,
    isResolvedAllReviewComments: true,
    isBranchOutOfDate: false,
    missingRequiredCheckNames: [],
    summary: {
      title: 'Scaffold React console UI under entry-points with build bundling',
      body: 'Adds the React + Vite + Tailwind scaffold and the committed `ui-dist` single artifact.',
      additions: 1184,
      deletions: 12,
      changedFiles: 27,
    },
  },
];

export const consoleIssueStateFixture: ConsoleIssueState = {
  state: 'open',
  merged: false,
  isPullRequest: true,
};
