import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleListItemsFixture } from '../fixtures';
import { ConsoleItemRow } from './ConsoleItemRow';

const meta: Meta<typeof ConsoleItemRow> = {
  title: 'Console/ConsoleItemRow',
  component: ConsoleItemRow,
};

export default meta;

type Story = StoryObj<typeof ConsoleItemRow>;

export const PullRequestRow: Story = {
  args: {
    item: consoleListItemsFixture[0],
    isSelected: false,
    onSelect: () => undefined,
  },
};

export const IssueRow: Story = {
  args: {
    item: consoleListItemsFixture[1],
    isSelected: false,
    onSelect: () => undefined,
  },
};

export const SelectedRow: Story = {
  args: {
    item: consoleListItemsFixture[1],
    isSelected: true,
    onSelect: () => undefined,
  },
};
