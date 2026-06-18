import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleItemIcon } from './ConsoleItemIcon';

const meta: Meta<typeof ConsoleItemIcon> = {
  title: 'Console/ConsoleItemIcon',
  component: ConsoleItemIcon,
};

export default meta;

type Story = StoryObj<typeof ConsoleItemIcon>;

export const IssueOpen: Story = {
  args: { isPr: false, state: 'open', stateReason: '' },
};

export const IssueClosedCompleted: Story = {
  args: { isPr: false, state: 'closed', stateReason: 'completed' },
};

export const IssueClosedNotPlanned: Story = {
  args: { isPr: false, state: 'closed', stateReason: 'not_planned' },
};

export const PullRequestOpen: Story = {
  args: { isPr: true, state: 'open' },
};

export const PullRequestDraft: Story = {
  args: { isPr: true, state: 'open', isDraft: true },
};

export const PullRequestMerged: Story = {
  args: { isPr: true, state: 'closed', merged: true },
};

export const PullRequestClosed: Story = {
  args: { isPr: true, state: 'closed' },
};
