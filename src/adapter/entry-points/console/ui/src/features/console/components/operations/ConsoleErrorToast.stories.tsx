import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleErrorToast } from './ConsoleUndoToast';

const meta: Meta<typeof ConsoleErrorToast> = {
  title: 'Console/ConsoleErrorToast',
  component: ConsoleErrorToast,
  args: {
    message: 'Operation failed: HTTP 422 Review cannot be requested',
    onDismiss: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleErrorToast>;

export const ReviewRejectedByGitHub: Story = {};

export const NetworkFailure: Story = {
  args: {
    message: 'Operation failed: network down',
  },
};
