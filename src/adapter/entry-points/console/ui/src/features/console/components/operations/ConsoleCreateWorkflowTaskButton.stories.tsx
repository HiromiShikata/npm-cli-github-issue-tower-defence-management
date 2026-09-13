import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCreateWorkflowTaskButton } from './ConsoleCreateWorkflowTaskButton';

const meta: Meta<typeof ConsoleCreateWorkflowTaskButton> = {
  title: 'Console/ConsoleCreateWorkflowTaskButton',
  component: ConsoleCreateWorkflowTaskButton,
};

export default meta;

type Story = StoryObj<typeof ConsoleCreateWorkflowTaskButton>;

export const Default: Story = {
  args: {
    onCreateWorkflowTask: async () =>
      'https://github.com/HiromiShikata/secretary/issues/1',
  },
};

export const WithError: Story = {
  args: {
    onCreateWorkflowTask: async () => {
      throw new Error('Failed to create issue: rate limit exceeded');
    },
  },
};
