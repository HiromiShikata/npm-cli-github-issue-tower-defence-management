import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStoryOptionsFixture } from '../../testing/fixtures';
import { ConsoleStorySelectActions } from './ConsoleStorySelectActions';

const meta: Meta<typeof ConsoleStorySelectActions> = {
  title: 'Console/ConsoleStorySelectActions',
  component: ConsoleStorySelectActions,
  args: { onSetStory: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleStorySelectActions>;

export const NoCurrentStory: Story = {
  args: {
    storyOptions: consoleStoryOptionsFixture,
    currentStoryName: null,
    currentStoryOptionId: null,
  },
};

export const WithCurrentStory: Story = {
  args: {
    storyOptions: consoleStoryOptionsFixture,
    currentStoryName: 'TDPM Console port',
    currentStoryOptionId: null,
  },
};

export const EmptyOptions: Story = {
  args: {
    storyOptions: [],
    currentStoryName: null,
    currentStoryOptionId: null,
  },
};

export const NameCollisionResolvedById: Story = {
  args: {
    storyOptions: [
      { id: 'story_1', name: 'regular / duplicate name', color: 'GRAY' },
      { id: 'story_2', name: 'regular / duplicate name', color: 'BLUE' },
    ],
    currentStoryName: 'regular / duplicate name',
    currentStoryOptionId: 'story_2',
  },
};
