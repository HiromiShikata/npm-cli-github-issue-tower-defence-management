import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import { ConsoleOperationBar } from './ConsoleOperationBar';

const meta: Meta<typeof ConsoleOperationBar> = {
  title: 'Console/ConsoleOperationBar',
  component: ConsoleOperationBar,
};

export default meta;

type Story = StoryObj<typeof ConsoleOperationBar>;

const sharedHandlers = {
  onReview: () => undefined,
  onSnooze: () => undefined,
  onSetStory: () => undefined,
  onSetStatus: () => undefined,
  onSetInTmux: () => undefined,
  onClose: () => undefined,
};

export const PrsTabPullRequest: Story = {
  args: {
    tab: 'prs',
    isPr: true,
    hasReviewTarget: true,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};

export const TriageTabIssueWithStoryGroup: Story = {
  args: {
    tab: 'triage',
    isPr: false,
    hasReviewTarget: false,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};

export const TodoByHumanIssue: Story = {
  args: {
    tab: 'todo-by-human',
    isPr: false,
    hasReviewTarget: false,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};

export const IssueWithLinkedPullRequest: Story = {
  args: {
    tab: 'unread',
    isPr: false,
    hasReviewTarget: true,
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    ...sharedHandlers,
  },
};
