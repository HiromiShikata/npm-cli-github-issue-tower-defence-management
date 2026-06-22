import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleUndoToast } from './ConsoleUndoToast';

const meta: Meta<typeof ConsoleUndoToast> = {
  title: 'Console/ConsoleUndoToast',
  component: ConsoleUndoToast,
  args: {
    message: 'Approved — PR #851',
    color: 'green',
    remainingSeconds: 5,
    progress: 1,
    onUndo: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleUndoToast>;

export const Approve: Story = {};

export const Reject: Story = {
  args: {
    message: 'Rejected — PR #853',
    color: 'amber',
    remainingSeconds: 3,
    progress: 0.6,
  },
};

export const StatusChange: Story = {
  args: {
    message: 'Status → Awaiting Workspace — #845',
    color: 'blue',
    remainingSeconds: 2,
    progress: 0.4,
  },
};

export const CloseIssue: Story = {
  args: {
    message: 'Closed — #845',
    color: 'red',
    remainingSeconds: 1,
    progress: 0.2,
  },
};
