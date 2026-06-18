import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStatusOptionsFixture } from '../fixtures';
import { ConsoleStatusButtonGroup } from './ConsoleStatusButtonGroup';

const meta: Meta<typeof ConsoleStatusButtonGroup> = {
  title: 'Console/ConsoleStatusButtonGroup',
  component: ConsoleStatusButtonGroup,
};

export default meta;

type Story = StoryObj<typeof ConsoleStatusButtonGroup>;

export const AllStatusOptions: Story = {
  args: {
    statusOptions: consoleStatusOptionsFixture,
    onSetStatus: () => undefined,
    onSetInTmux: () => undefined,
  },
};

export const SubsetOfStatusOptions: Story = {
  args: {
    statusOptions: consoleStatusOptionsFixture.filter(
      (option) => option.name !== 'In Tmux by agent',
    ),
    onSetStatus: () => undefined,
    onSetInTmux: () => undefined,
  },
};
