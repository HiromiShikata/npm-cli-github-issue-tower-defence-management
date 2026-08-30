import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleOperationHandlers } from '../../logic/operations';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleOperationMenu } from './ConsoleOperationMenu';

const handlers: ConsoleOperationHandlers = {
  onReview: () => {},
  onSetNextActionDate: () => {},
  onSetStory: () => {},
  onSetStatus: () => {},
  onSetInTmuxByHuman: () => {},
  onClose: () => {},
  onOkAndAwaitingWorkspace: () => {},
  onDeleteAllComments: () => {},
  onSetDependedIssueUrl: async () => {},
};

const meta: Meta<typeof ConsoleOperationMenu> = {
  title: 'Console/ConsoleOperationMenu',
  component: ConsoleOperationMenu,
  args: {
    rejectEnabled: false,
    statusOptions: consoleStatusOptionsFixture,
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

export const PrsTabPullRequestRejectEnabled: Story = {
  args: {
    tab: 'prs',
    item: consoleListItemsFixture[0],
    hasPullRequest: true,
    rejectEnabled: true,
  },
};

export const TodoByHumanTabIssue: Story = {
  args: {
    tab: 'todo-by-human',
    item: consoleListItemsFixture[2],
    hasPullRequest: false,
  },
};

export const TodoByAgentTabIssue: Story = {
  args: {
    tab: 'todo-by-agent',
    item: consoleListItemsFixture[2],
    hasPullRequest: false,
  },
};
