import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStoryOptionsFixture } from '../fixtures';
import { ConsoleStoryButtonGroup } from './ConsoleStoryButtonGroup';

const meta: Meta<typeof ConsoleStoryButtonGroup> = {
  title: 'Console/ConsoleStoryButtonGroup',
  component: ConsoleStoryButtonGroup,
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryButtonGroup>;

export const AssignableStories: Story = {
  args: {
    storyOptions: consoleStoryOptionsFixture,
    onSetStory: () => undefined,
  },
};
