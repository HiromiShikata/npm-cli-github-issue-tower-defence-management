import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  consoleAgentOptionsFixture,
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../../testing/fixtures';
import { ConsoleQueuedItemRow } from './ConsoleQueuedItemRow';

const meta: Meta<typeof ConsoleQueuedItemRow> = {
  title: 'Console/ConsoleQueuedItemRow',
  component: ConsoleQueuedItemRow,
  args: {
    onSelect: () => {},
    statusOptions: consoleStatusOptionsFixture,
    agentOptions: consoleAgentOptionsFixture,
    isActive: false,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleQueuedItemRow>;

export const AwaitingWorkspaceRow: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[1],
      status: 'Awaiting Workspace',
      agent: null,
    },
  },
};

export const PreparationWithAgent: Story = {
  args: { item: consoleListItemsFixture[5] },
};

export const PreparationNoAgent: Story = {
  args: {
    item: {
      ...consoleListItemsFixture[1],
      status: 'Preparation',
      agent: null,
    },
  },
};

export const ActiveRow: Story = {
  args: { item: consoleListItemsFixture[5], isActive: true },
};
