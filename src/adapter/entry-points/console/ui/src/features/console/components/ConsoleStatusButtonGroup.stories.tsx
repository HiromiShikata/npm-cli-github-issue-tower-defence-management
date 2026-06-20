import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStatusOptionsFixture } from '../fixtures';
import { ConsoleStatusButtonGroup } from './ConsoleStatusButtonGroup';

const meta: Meta<typeof ConsoleStatusButtonGroup> = {
  title: 'Console/ConsoleStatusButtonGroup',
  component: ConsoleStatusButtonGroup,
  args: { onSetStatus: () => {}, onSetInTmuxByHuman: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleStatusButtonGroup>;

export const AllStatusOptions: Story = {
  args: { statusOptions: consoleStatusOptionsFixture },
};
