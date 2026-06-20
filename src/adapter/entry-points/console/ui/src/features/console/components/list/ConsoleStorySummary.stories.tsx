import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStorySummary } from './ConsoleStorySummary';

const meta: Meta<typeof ConsoleStorySummary> = {
  title: 'Console/ConsoleStorySummary',
  component: ConsoleStorySummary,
};

export default meta;

type Story = StoryObj<typeof ConsoleStorySummary>;

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
