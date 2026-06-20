import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleListItemRow } from './ConsoleListItemRow';

const meta: Meta<typeof ConsoleListItemRow> = {
  title: 'Console/ConsoleListItemRow',
  component: ConsoleListItemRow,
  args: { onSelect: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleListItemRow>;

export const PullRequestRow: Story = {
  args: { item: consoleListItemsFixture[0], isActive: false },
};

export const IssueRow: Story = {
  args: { item: consoleListItemsFixture[2], isActive: false },
};

export const ActiveRow: Story = {
  args: { item: consoleListItemsFixture[0], isActive: true },
};
