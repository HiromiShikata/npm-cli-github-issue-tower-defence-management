import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
  consoleMermaidBodyFixture,
  consoleReferenceStatesFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleReferenceLink } from '../content/ConsoleReferenceLink';
import { ConsoleOperationMenu } from '../operations/ConsoleOperationMenu';
import { ConsoleItemDetail } from './ConsoleItemDetail';

const renderDependedIssueUrlReferenceLink = (
  href: string,
  fallbackText: string,
) => (
  <ConsoleReferenceLink
    href={href}
    fallbackText={fallbackText}
    state={consoleReferenceStatesFixture[href] ?? null}
  />
);

const noopOperationHandlers: ConsoleOperationHandlers = {
  onReview: () => {},
  onSetNextActionDate: () => {},
  onSetStory: () => {},
  onSetAgent: () => {},
  onSetStatus: () => {},
  onSetInTmuxByHuman: () => {},
  onClose: () => {},
  onOkAndAwaitingWorkspace: () => {},
  onDeleteAllComments: () => {},
  onDeleteStory: null,
  onSetDependedIssueUrl: async () => {},
};

const richMarkdownBody = [
  '# Console review screen',
  '',
  'Heading levels and code blocks must render with styles.',
  '',
  '## Acceptance criteria',
  '### Action bar',
  '#### Markdown styling',
  '##### Scroll reset',
  '###### Comment isolation',
  '',
  'Run the build with `npm run build:console-ui` before committing.',
  '',
  '```ts',
  'export const renderMarkdownToSafeHtml = (source: string): string => {',
  '  marked.setOptions({ gfm: true, breaks: true });',
  '  return DOMPurify.sanitize(marked.parse(source, { async: false }));',
  '};',
  '```',
  '',
  '> The action bar stays in document flow and never overlaps content.',
  '',
  '- Headings use a font-size scale',
  '- Code blocks scroll horizontally',
].join('\n');

const meta: Meta<typeof ConsoleItemDetail> = {
  title: 'Console/ConsoleItemDetail',
  component: ConsoleItemDetail,
  args: {
    now: Date.parse('2026-06-19T12:00:00.000Z'),
    statusOptions: consoleStatusOptionsFixture,
    commentComposer: null,
    operationBar: null,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemDetail>;

export const PullRequestItemHeadArrangement: Story = {
  args: {
    item: consoleListItemsFixture[0],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: { name: 'Awaiting Workspace', color: 'BLUE' },
    state: {
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Add serveConsole subcommand under entry-points',
    },
    body: '',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: {
      found: true,
      isConflicted: false,
      mergeableStatus: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    },
    relatedPullRequests: [],
  },
};

export const IssueItemWithLinkedPrHeadArrangement: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: { name: 'In Progress', color: 'GREEN' },
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [
      {
        pullRequest: consoleRelatedPullRequestsFixture[0],
        files: [],
        filesAreLoading: false,
        filesError: null,
        commits: [],
        commitsAreLoading: false,
        commitsError: null,
      },
    ],
  },
};

export const PullRequestItem: Story = {
  args: {
    item: consoleListItemsFixture[0],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: { name: 'Awaiting Workspace', color: 'BLUE' },
    state: {
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Add serveConsole subcommand under entry-points',
    },
    body: consoleMermaidBodyFixture,
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: consoleCommentsFixture,
    commentsAreLoading: false,
    commentsError: null,
    files: consoleChangedFilesFixture,
    filesAreLoading: false,
    filesError: null,
    commits: consoleCommitsFixture,
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: {
      found: true,
      isConflicted: false,
      mergeableStatus: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    },
    relatedPullRequests: [],
  },
};

export const PullRequestItemFailingCiWithConflict: Story = {
  args: {
    item: consoleListItemsFixture[0],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: { name: 'Awaiting Owner', color: 'YELLOW' },
    state: {
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Add serveConsole subcommand under entry-points',
    },
    body: consoleMermaidBodyFixture,
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: consoleCommentsFixture,
    commentsAreLoading: false,
    commentsError: null,
    files: consoleChangedFilesFixture,
    filesAreLoading: false,
    filesError: null,
    commits: consoleCommitsFixture,
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: {
      found: true,
      isConflicted: true,
      mergeableStatus: 'CONFLICTING',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: true,
      missingRequiredCheckNames: ['build', 'test'],
    },
    relatedPullRequests: [],
  },
};

export const IssueWithRichMarkdownBody: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: richMarkdownBody,
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: consoleCommentsFixture,
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    operationBar: (
      <ConsoleOperationMenu
        tab="todo-by-human"
        item={consoleListItemsFixture[2]}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        currentStoryName={null}
        currentStoryOptionId={null}
        agentOptions={[]}
        currentAgentName={null}
        handlers={noopOperationHandlers}
        isVisible={true}
      />
    ),
  },
};

export const IssueWithLinkedPullRequest: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nThis issue has a linked pull request.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: consoleCommentsFixture,
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [
      {
        pullRequest: consoleRelatedPullRequestsFixture[0],
        files: consoleChangedFilesFixture,
        filesAreLoading: false,
        filesError: null,
        commits: consoleCommitsFixture,
        commitsAreLoading: false,
        commitsError: null,
      },
    ],
    onAddInlineComment: async (path, line, side, body) => {
      window.alert(`comment on ${path}:${line} (${side})\n${body}`);
    },
  },
};

export const IssueWithLinkedPullRequestFailingCi: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nThis issue has a linked pull request with failing CI.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [
      {
        pullRequest: {
          ...consoleRelatedPullRequestsFixture[0],
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build', 'test'],
        },
        files: [],
        filesAreLoading: false,
        filesError: null,
        commits: [],
        commitsAreLoading: false,
        commitsError: null,
      },
    ],
  },
};

export const IssueWithTwoLinkedPullRequests: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nThis issue has two linked pull requests.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [
      {
        pullRequest: consoleRelatedPullRequestsFixture[0],
        files: [],
        filesAreLoading: false,
        filesError: null,
        commits: [],
        commitsAreLoading: false,
        commitsError: null,
      },
      {
        pullRequest: {
          ...consoleRelatedPullRequestsFixture[0],
          url: 'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/850',
          branchName: 'feature/850-other-change',
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: false,
          isConflicted: true,
          mergeableStatus: 'CONFLICTING',
          missingRequiredCheckNames: ['build'],
        },
        files: [],
        filesAreLoading: false,
        filesError: null,
        commits: [],
        commitsAreLoading: false,
        commitsError: null,
      },
    ],
  },
};

export const IssueWithEveryReadFailedByOneCause: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: null,
    body: '',
    bodyIsLoading: false,
    bodyError: 'API rate limit already exceeded',
    stateError: 'API rate limit already exceeded',
    pullRequestStatusError: null,
    relatedPullRequestsError: 'API rate limit already exceeded',
    comments: [],
    commentsAreLoading: false,
    commentsError: 'API rate limit already exceeded',
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
  },
};

export const IssueWithSnapshotStatusNoOverlay: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nThis item has a status set in the snapshot.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
  },
};

export const IssueWithAgent: Story = {
  args: {
    item: consoleListItemsFixture[5],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Display agent field next to status in TDPM console items',
    },
    body: '## Issue body\n\nThis item has both a status and an agent set.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
  },
};

export const IssueWithNoCommentsDescriptionOpen: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nNo comments yet — description renders expanded.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
  },
};

export const IssueWithCommentsDescriptionCollapsed: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Scaffold React console UI under entry-points with build bundling',
    },
    body: '## Issue body\n\nComments exist — description renders collapsed so the last comment is the first view.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: consoleCommentsFixture,
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
  },
};

const dependedIssueUrlResolvedOpen =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845';
const dependedIssueUrlResolvedClosed =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/692';
const dependedIssueUrlResolvedMergedPr =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/851';
const dependedIssueUrlUnresolvedGitHubReference =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/860';
const dependedIssueUrlNotGitHub = 'https://example.com/not-a-github-reference';

export const IssueWithNoDependedIssueUrls: Story = {
  args: {
    item: { ...consoleListItemsFixture[3], dependedIssueUrls: [] },
    storyName: 'regular / workflow improvement',
    storyColorEnum: 'GRAY',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    },
    body: '## Issue body\n\nThis item has zero depended issue URLs, so no Depended Issue URL row renders.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    renderReferenceLink: renderDependedIssueUrlReferenceLink,
  },
};

export const IssueWithOneResolvedDependedIssueUrl: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[3],
      dependedIssueUrls: [dependedIssueUrlResolvedOpen],
    },
    storyName: 'regular / workflow improvement',
    storyColorEnum: 'GRAY',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    },
    body: '## Issue body\n\nThis item depends on a resolved issue, so the row shows its title.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    renderReferenceLink: renderDependedIssueUrlReferenceLink,
  },
};

export const IssueWithOneUnresolvedDependedIssueUrlParsingAsGitHubReference: Story =
  {
    args: {
      item: {
        ...consoleListItemsFixture[3],
        dependedIssueUrls: [dependedIssueUrlUnresolvedGitHubReference],
      },
      storyName: 'regular / workflow improvement',
      storyColorEnum: 'GRAY',
      overlayStatus: null,
      state: {
        state: 'open',
        merged: false,
        isPullRequest: false,
        title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
      },
      body: '## Issue body\n\nThis item depends on an unresolved issue URL that still parses as a GitHub reference, so the row falls back to the plain `#number` label.',
      bodyIsLoading: false,
      bodyError: null,
      stateError: null,
      pullRequestStatusError: null,
      relatedPullRequestsError: null,
      comments: [],
      commentsAreLoading: false,
      commentsError: null,
      files: [],
      filesAreLoading: false,
      filesError: null,
      commits: [],
      commitsAreLoading: false,
      commitsError: null,
      pullRequestStatus: null,
      relatedPullRequests: [],
      renderReferenceLink: renderDependedIssueUrlReferenceLink,
    },
  };

export const IssueWithOneUnresolvedDependedIssueUrlNotGitHub: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[3],
      dependedIssueUrls: [dependedIssueUrlNotGitHub],
    },
    storyName: 'regular / workflow improvement',
    storyColorEnum: 'GRAY',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    },
    body: '## Issue body\n\nThis item depends on a URL that does not parse as a GitHub reference, so the row falls back to the raw URL.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    renderReferenceLink: renderDependedIssueUrlReferenceLink,
  },
};

export const IssueWithMultipleDependedIssueUrls: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[3],
      dependedIssueUrls: [
        dependedIssueUrlResolvedOpen,
        dependedIssueUrlResolvedClosed,
        dependedIssueUrlResolvedMergedPr,
      ],
    },
    storyName: 'regular / workflow improvement',
    storyColorEnum: 'GRAY',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    },
    body: '## Issue body\n\nThis item depends on three separate issues and pull requests, each rendered as its own link.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    renderReferenceLink: renderDependedIssueUrlReferenceLink,
  },
};

export const IssueWithDuplicateDependedIssueUrls: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[3],
      dependedIssueUrls: [
        dependedIssueUrlResolvedOpen,
        dependedIssueUrlResolvedOpen,
      ],
    },
    storyName: 'regular / workflow improvement',
    storyColorEnum: 'GRAY',
    overlayStatus: null,
    state: {
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Add Sonnet to Opus weekly-limit fallback routing per token',
    },
    body: '## Issue body\n\nThis item lists the same depended issue URL twice; each duplicate renders as its own separate link.',
    bodyIsLoading: false,
    bodyError: null,
    stateError: null,
    pullRequestStatusError: null,
    relatedPullRequestsError: null,
    comments: [],
    commentsAreLoading: false,
    commentsError: null,
    files: [],
    filesAreLoading: false,
    filesError: null,
    commits: [],
    commitsAreLoading: false,
    commitsError: null,
    pullRequestStatus: null,
    relatedPullRequests: [],
    renderReferenceLink: renderDependedIssueUrlReferenceLink,
  },
};
