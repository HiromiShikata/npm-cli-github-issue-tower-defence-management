import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleListItemsFixture } from '../../testing/fixtures';
import { ConsoleItemSummary } from './ConsoleItemSummary';

const meta: Meta<typeof ConsoleItemSummary> = {
  title: 'Console/ConsoleItemSummary',
  component: ConsoleItemSummary,
  args: { onSelect: () => {}, now: Date.parse('2026-06-19T12:00:00.000Z') },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemSummary>;

export const PullRequestRow: Story = {
  args: { item: consoleListItemsFixture[0], isActive: false },
};

export const IssueRow: Story = {
  args: { item: consoleListItemsFixture[2], isActive: false },
};

export const ReactivationTriggerRow: Story = {
  args: { item: consoleListItemsFixture[3], isActive: false },
};

export const ActiveRow: Story = {
  args: { item: consoleListItemsFixture[0], isActive: true },
};
