import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
  consoleMermaidBodyFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleOperationMenu } from '../operations/ConsoleOperationMenu';
import { ConsoleItemDetail } from './ConsoleItemDetail';

const noopOperationHandlers: ConsoleOperationHandlers = {
  onReview: () => {},
  onSetNextActionDate: () => {},
  onSetStory: () => {},
  onSetStatus: () => {},
  onSetInTmuxByHuman: () => {},
  onClose: () => {},
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
    commentComposer: null,
    operationBar: null,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemDetail>;

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
    overlayStatus: { name: 'Awaiting Quality Check', color: 'YELLOW' },
    state: {
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Add serveConsole subcommand under entry-points',
    },
    body: consoleMermaidBodyFixture,
    bodyIsLoading: false,
    bodyError: null,
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
        tab="triage"
        item={consoleListItemsFixture[2]}
        hasPullRequest={false}
        rejectEnabled={false}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        handlers={noopOperationHandlers}
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
