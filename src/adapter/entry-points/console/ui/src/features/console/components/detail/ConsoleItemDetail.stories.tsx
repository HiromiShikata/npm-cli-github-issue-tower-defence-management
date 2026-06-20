import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
  consoleMermaidBodyFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

const meta: Meta<typeof ConsoleItemDetail> = {
  title: 'Console/ConsoleItemDetail',
  component: ConsoleItemDetail,
  args: {
    now: Date.parse('2026-06-19T12:00:00.000Z'),
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
    overlayStatus: null,
    state: { state: 'open', merged: false, isPullRequest: true },
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
    relatedPullRequests: [],
  },
};

export const IssueWithLinkedPullRequest: Story = {
  args: {
    item: consoleListItemsFixture[2],
    storyName: 'TDPM Console port',
    storyColorEnum: 'BLUE',
    overlayStatus: null,
    state: { state: 'open', merged: false, isPullRequest: false },
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
  },
};
