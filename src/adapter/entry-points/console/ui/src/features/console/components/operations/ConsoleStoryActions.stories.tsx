import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStoryOptionsFixture } from '../../testing/fixtures';
import { ConsoleStoryActions } from './ConsoleStoryActions';

const meta: Meta<typeof ConsoleStoryActions> = {
  title: 'Console/ConsoleStoryActions',
  component: ConsoleStoryActions,
  args: { onSetStory: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryActions>;

export const AssignableStories: Story = {
  args: { storyOptions: consoleStoryOptionsFixture },
};
