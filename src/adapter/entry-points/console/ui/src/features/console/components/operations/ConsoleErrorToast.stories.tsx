import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleErrorToast } from './ConsoleUndoToast';

const meta: Meta<typeof ConsoleErrorToast> = {
  title: 'Console/ConsoleErrorToast',
  component: ConsoleErrorToast,
  args: {
    title: 'Approved — PR #851',
    message: 'Operation failed: HTTP 422 Review cannot be requested',
    onDismiss: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleErrorToast>;

export const ReviewRejectedByGitHub: Story = {};

export const NetworkFailure: Story = {
  args: {
    title: 'Approved — PR #851',
    message: 'Operation failed: network down',
  },
};

export const AirplaneModeGuard: Story = {
  args: {
    title: 'Airplane mode',
    message:
      'Operation failed: This action requires a network connection. Turn off airplane mode and try again.',
  },
};
