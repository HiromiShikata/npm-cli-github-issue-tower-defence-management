import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryTaskCreateModalDialog } from './ConsoleStoryTaskCreateModalDialog';

const meta: Meta<typeof ConsoleStoryTaskCreateModalDialog> = {
  title: 'Console/ConsoleStoryTaskCreateModalDialog',
  component: ConsoleStoryTaskCreateModalDialog,
  args: {
    storyName: 'TDPM Console port',
    onSubmit: () => Promise.resolve(),
    onClose: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryTaskCreateModalDialog>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    onSubmit: () => Promise.reject(new Error('GitHub API rate limit exceeded')),
  },
};

export const WithEditButton: Story = {
  args: {
    onSubmit: () => Promise.reject(new Error('GitHub API rate limit exceeded')),
    onEdit: () => undefined,
  },
};
