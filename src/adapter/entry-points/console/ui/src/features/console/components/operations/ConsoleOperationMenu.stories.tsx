import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleOperationMenu } from './ConsoleOperationMenu';

const handlers: ConsoleOperationHandlers = {
  onReview: () => {},
  onSetNextActionDate: () => {},
  onSetStory: () => {},
  onSetStatus: () => {},
  onSetInTmuxByHuman: () => {},
  onClose: () => {},
};

const meta: Meta<typeof ConsoleOperationMenu> = {
  title: 'Console/ConsoleOperationMenu',
  component: ConsoleOperationMenu,
  args: {
    statusOptions: consoleStatusOptionsFixture,
    storyOptions: consoleStoryOptionsFixture,
    handlers,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleOperationMenu>;

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
