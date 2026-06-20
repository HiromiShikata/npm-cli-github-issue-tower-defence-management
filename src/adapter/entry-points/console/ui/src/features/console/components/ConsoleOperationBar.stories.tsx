import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import type { ConsoleOperationHandlers } from '../operations';
import { ConsoleOperationBar } from './ConsoleOperationBar';

const handlers: ConsoleOperationHandlers = {
  onReview: () => {},
  onSetNextActionDate: () => {},
  onSetStory: () => {},
  onSetStatus: () => {},
  onSetInTmuxByHuman: () => {},
  onClose: () => {},
};

const meta: Meta<typeof ConsoleOperationBar> = {
  title: 'Console/ConsoleOperationBar',
  component: ConsoleOperationBar,
  args: {
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    handlers,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleOperationBar>;

export const PrsTabPullRequest: Story = {
  args: {
    tab: 'prs',
    item: consoleListItemsFixture[0],
    hasPullRequest: true,
  },
};

export const TriageTabIssueWithStoryGroup: Story = {
  args: {
    tab: 'triage',
    item: consoleListItemsFixture[2],
    hasPullRequest: false,
  },
};

export const TodoByHumanTabIssue: Story = {
  args: {
    tab: 'todo-by-human',
    item: consoleListItemsFixture[2],
    hasPullRequest: false,
  },
};
