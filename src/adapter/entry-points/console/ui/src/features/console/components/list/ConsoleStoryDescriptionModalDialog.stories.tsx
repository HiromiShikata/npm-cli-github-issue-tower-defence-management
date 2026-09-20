import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryDescriptionModalDialog } from './ConsoleStoryDescriptionModalDialog';

const meta: Meta<typeof ConsoleStoryDescriptionModalDialog> = {
  title: 'Console/ConsoleStoryDescriptionModalDialog',
  component: ConsoleStoryDescriptionModalDialog,
  args: {
    currentDescription: '',
    onSubmit: () => Promise.resolve(),
    onClose: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryDescriptionModalDialog>;

export const Empty: Story = {};

export const WithExistingDescription: Story = {
  args: {
    currentDescription:
      'Rebuild the TDPM console UI with proper modal dialogs following general UI best practices.',
  },
};
