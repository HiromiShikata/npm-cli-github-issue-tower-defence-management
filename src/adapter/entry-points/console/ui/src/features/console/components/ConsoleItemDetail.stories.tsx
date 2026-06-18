import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleCommentsFixture,
  consoleListItemsFixture,
  consoleMermaidBodyFixture,
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

const meta: Meta<typeof ConsoleItemDetail> = {
  title: 'Console/ConsoleItemDetail',
  component: ConsoleItemDetail,
};

export default meta;

type Story = StoryObj<typeof ConsoleItemDetail>;

const sharedHandlers = {
  onReview: () => undefined,
  onSnooze: () => undefined,
  onSetStory: () => undefined,
  onSetStatus: () => undefined,
  onSetInTmux: () => undefined,
  onClose: () => undefined,
};

export const PullRequestItem: Story = {
  args: {
    tab: 'prs',
    item: consoleListItemsFixture[0],
    body: consoleMermaidBodyFixture,
    isBodyLoading: false,
    bodyError: null,
    comments: consoleCommentsFixture,
    areCommentsLoading: false,
    commentsError: null,
    pullRequestDetail: consolePullRequestDetailFixture,
    relatedPullRequests: [],
    isPullRequestLoading: false,
    pullRequestError: null,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};

export const TriageIssueWithLinkedPullRequest: Story = {
  args: {
    tab: 'triage',
    item: consoleListItemsFixture[1],
    body: consoleMermaidBodyFixture,
    isBodyLoading: false,
    bodyError: null,
    comments: consoleCommentsFixture,
    areCommentsLoading: false,
    commentsError: null,
    pullRequestDetail: consolePullRequestDetailFixture,
    relatedPullRequests: consoleRelatedPullRequestsFixture,
    isPullRequestLoading: false,
    pullRequestError: null,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};

export const BodyLoading: Story = {
  args: {
    tab: 'unread',
    item: consoleListItemsFixture[2],
    body: '',
    isBodyLoading: true,
    bodyError: null,
    comments: [],
    areCommentsLoading: true,
    commentsError: null,
    pullRequestDetail: null,
    relatedPullRequests: [],
    isPullRequestLoading: false,
    pullRequestError: null,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};
