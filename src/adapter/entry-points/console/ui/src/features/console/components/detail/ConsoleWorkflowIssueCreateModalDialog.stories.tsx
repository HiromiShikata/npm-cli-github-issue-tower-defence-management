import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleWorkflowIssueCreateModalDialog } from './ConsoleWorkflowIssueCreateModalDialog';

const meta: Meta<typeof ConsoleWorkflowIssueCreateModalDialog> = {
  title: 'Console/ConsoleWorkflowIssueCreateModalDialog',
  component: ConsoleWorkflowIssueCreateModalDialog,
};

export default meta;

type Story = StoryObj<typeof ConsoleWorkflowIssueCreateModalDialog>;

export const Default: Story = {
  args: {
    defaultTitle: 'Fix TDPM console comment workflow-issue create button',
    defaultBody:
      '> Please split the token validation into its own tested function.\n> This will make it easier to test edge cases.',
    onSubmit: async () => {},
    onClose: () => {},
  },
};

export const WithLongBody: Story = {
  args: {
    defaultTitle: 'Improve error handling in the console UI',
    defaultBody:
      '> The error handling in the console UI is currently not very user-friendly.\n> When an API call fails, the error message is not shown to the user.\n> We should add a proper error message that the user can understand.\n> Also, we should add a retry button so the user can try again.',
    onSubmit: async () => {},
    onClose: () => {},
  },
};
