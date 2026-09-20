import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryCreateModalDialog } from './ConsoleStoryCreateModalDialog';

const meta: Meta<typeof ConsoleStoryCreateModalDialog> = {
  title: 'Console/ConsoleStoryCreateModalDialog',
  component: ConsoleStoryCreateModalDialog,
  args: {
    onSubmit: () => Promise.resolve(),
    onClose: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryCreateModalDialog>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    onSubmit: () => Promise.reject(new Error('Story name already exists')),
  },
};
