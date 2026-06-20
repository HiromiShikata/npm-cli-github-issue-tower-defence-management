import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryGroupHeader } from './ConsoleStoryGroupHeader';

const meta: Meta<typeof ConsoleStoryGroupHeader> = {
  title: 'Console/ConsoleStoryGroupHeader',
  component: ConsoleStoryGroupHeader,
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryGroupHeader>;

export const ConsolePortStory: Story = {
  args: { story: 'TDPM Console port', count: 4, colorEnum: 'BLUE' },
};

export const RegularWorkflowStory: Story = {
  args: {
    story: 'regular / workflow improvement',
    count: 12,
    colorEnum: 'GRAY',
  },
};

export const NoStory: Story = {
  args: { story: '(No story)', count: 3, colorEnum: null },
};
