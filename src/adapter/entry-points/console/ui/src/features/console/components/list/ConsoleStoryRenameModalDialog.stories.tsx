import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryRenameModalDialog } from './ConsoleStoryRenameModalDialog';

const meta: Meta<typeof ConsoleStoryRenameModalDialog> = {
  title: 'Console/ConsoleStoryRenameModalDialog',
  component: ConsoleStoryRenameModalDialog,
  args: {
    currentName: 'TDPM Console port',
    onSubmit: () => Promise.resolve(),
    onClose: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryRenameModalDialog>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    onSubmit: () => Promise.reject(new Error('Story name already in use')),
  },
};
