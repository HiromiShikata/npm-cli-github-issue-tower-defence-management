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

export const WithRetry: Story = {
  args: {
    title: 'Approved — PR #851',
    message: 'Operation failed: HTTP 422 Review cannot be requested',
    onRetry: () => {},
  },
};

export const DismissOnly: Story = {
  args: {
    title: 'Airplane mode',
    message:
      'Operation failed: This action requires a network connection. Turn off airplane mode and try again.',
    onRetry: undefined,
  },
};

export const LongMessage: Story = {
  args: {
    title: 'Approved — PR #851',
    message:
      'Operation failed: Unprocessable Entity — The review cannot be requested because the pull request is in a draft state and the reviewer has already submitted a review. Please resolve the existing review first, convert the PR to ready for review, and then request a new review from the appropriate reviewer.',
    onRetry: () => {},
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Agent → agent-and-skill-definition-improver — #6597',
    message: 'Operation failed: HTTP 422 Review cannot be requested',
    onRetry: () => {},
  },
};
