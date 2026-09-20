import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryDeleteModalDialog } from './ConsoleStoryDeleteModalDialog';

const meta: Meta<typeof ConsoleStoryDeleteModalDialog> = {
  title: 'Console/ConsoleStoryDeleteModalDialog',
  component: ConsoleStoryDeleteModalDialog,
  args: {
    storyName: 'TDPM Console port',
    isDeleting: false,
    deleteError: null,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryDeleteModalDialog>;

export const Default: Story = {};

export const Deleting: Story = {
  args: {
    isDeleting: true,
  },
};

export const WithError: Story = {
  args: {
    deleteError: 'Cannot delete story with 12 open tasks assigned to other stories.',
  },
};
