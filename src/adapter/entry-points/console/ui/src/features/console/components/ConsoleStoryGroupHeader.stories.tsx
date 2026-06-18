import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryGroupHeader } from './ConsoleStoryGroupHeader';

const meta: Meta<typeof ConsoleStoryGroupHeader> = {
  title: 'Console/ConsoleStoryGroupHeader',
  component: ConsoleStoryGroupHeader,
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryGroupHeader>;

export const ConsolePortStory: Story = {
  args: { story: 'TDPM Console port', color: 'BLUE', count: 3 },
};

export const WorkflowStory: Story = {
  args: { story: 'regular / workflow improvement', color: 'GREEN', count: 8 },
};
