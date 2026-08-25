import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryReorderPanel } from './ConsoleStoryReorderPanel';

const stories = [
  { id: '1491051e', name: 'TDPM Console port', color: 'BLUE' as const },
  {
    id: 'f7cd5cbc',
    name: 'Publish product documentation site',
    color: 'GREEN' as const,
  },
  { id: 'a3b9c4d2', name: 'regular / WORKFLOW BLOCKER', color: 'RED' as const },
];

const meta: Meta<typeof ConsoleStoryReorderPanel> = {
  title: 'Console/ConsoleStoryReorderPanel',
  component: ConsoleStoryReorderPanel,
  args: { onReorderStory: () => Promise.resolve() },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryReorderPanel>;

export const Default: Story = {
  args: { stories },
};

export const SingleStory: Story = {
  args: { stories: [stories[0]] },
};
