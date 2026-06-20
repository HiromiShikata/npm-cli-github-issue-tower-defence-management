import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleItemIcon } from './ConsoleItemIcon';

const meta: Meta<typeof ConsoleItemIcon> = {
  title: 'Console/ConsoleItemIcon',
  component: ConsoleItemIcon,
  args: { size: 20 },
};

export default meta;

type Story = StoryObj<typeof ConsoleItemIcon>;

export const PullRequestOpen: Story = {
  args: {
    isPr: true,
    state: 'open',
    merged: false,
    isDraft: false,
    stateReason: '',
  },
};

export const PullRequestMerged: Story = {
  args: {
    isPr: true,
    state: 'closed',
    merged: true,
    isDraft: false,
    stateReason: '',
  },
};

export const PullRequestClosed: Story = {
  args: {
    isPr: true,
    state: 'closed',
    merged: false,
    isDraft: false,
    stateReason: '',
  },
};

export const PullRequestDraft: Story = {
  args: {
    isPr: true,
    state: 'open',
    merged: false,
    isDraft: true,
    stateReason: '',
  },
};

export const IssueOpen: Story = {
  args: {
    isPr: false,
    state: 'open',
    merged: false,
    isDraft: false,
    stateReason: '',
  },
};

export const IssueClosedCompleted: Story = {
  args: {
    isPr: false,
    state: 'closed',
    merged: false,
    isDraft: false,
    stateReason: 'completed',
  },
};

export const IssueClosedNotPlanned: Story = {
  args: {
    isPr: false,
    state: 'closed',
    merged: false,
    isDraft: false,
    stateReason: 'not_planned',
  },
};
