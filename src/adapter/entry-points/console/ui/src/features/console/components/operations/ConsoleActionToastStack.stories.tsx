import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleActionToastStack } from './ConsoleActionToastStack';

const meta: Meta<typeof ConsoleActionToastStack> = {
  title: 'Console/ConsoleActionToastStack',
  component: ConsoleActionToastStack,
  args: {
    displayLimit: 4,
    onUndo: () => {},
    onDismiss: () => {},
    onDismissError: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleActionToastStack>;

export const MultipleSimultaneousActions: Story = {
  args: {
    pendingEntries: [
      {
        id: 'pending-1',
        createdAt: 1,
        message: 'Approved — PR #851',
        color: 'green',
        remainingSeconds: 5,
        progress: 1,
      },
      {
        id: 'pending-2',
        createdAt: 2,
        message: 'Rejected — PR #853',
        color: 'amber',
        remainingSeconds: 3,
        progress: 0.6,
      },
    ],
    errorEntries: [
      {
        id: 'error-1',
        createdAt: 3,
        message: 'Approved — PR #849',
        reason: 'HTTP 422 Review cannot be requested',
      },
    ],
  },
};

export const OverflowWithExpandToggle: Story = {
  args: {
    pendingEntries: [
      {
        id: 'pending-1',
        createdAt: 1,
        message: 'Approved — PR #851',
        color: 'green',
        remainingSeconds: 5,
        progress: 1,
      },
      {
        id: 'pending-2',
        createdAt: 2,
        message: 'Rejected — PR #853',
        color: 'amber',
        remainingSeconds: 3,
        progress: 0.6,
      },
      {
        id: 'pending-3',
        createdAt: 4,
        message: 'Approved — PR #857',
        color: 'green',
        remainingSeconds: 4,
        progress: 0.8,
      },
      {
        id: 'pending-4',
        createdAt: 6,
        message: 'Approved — PR #861',
        color: 'green',
        remainingSeconds: 2,
        progress: 0.4,
      },
    ],
    errorEntries: [
      {
        id: 'error-1',
        createdAt: 3,
        message: 'Approved — PR #849',
        reason: 'HTTP 422 Review cannot be requested',
      },
      {
        id: 'error-2',
        createdAt: 5,
        message: 'Airplane mode',
        reason:
          'This action requires a network connection. Turn off airplane mode and try again.',
      },
    ],
  },
};
