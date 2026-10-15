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
        createdAt: Date.now() - 1000,
        message: 'Approved — PR #851',
        color: 'green',
      },
      {
        id: 'pending-2',
        createdAt: Date.now() - 2000,
        message: 'Rejected — PR #853',
        color: 'amber',
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
        createdAt: Date.now() - 1000,
        message: 'Approved — PR #851',
        color: 'green',
      },
      {
        id: 'pending-2',
        createdAt: Date.now() - 2000,
        message: 'Rejected — PR #853',
        color: 'amber',
      },
      {
        id: 'pending-3',
        createdAt: Date.now() - 1500,
        message: 'Approved — PR #857',
        color: 'green',
      },
      {
        id: 'pending-4',
        createdAt: Date.now() - 3500,
        message: 'Approved — PR #861',
        color: 'green',
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
