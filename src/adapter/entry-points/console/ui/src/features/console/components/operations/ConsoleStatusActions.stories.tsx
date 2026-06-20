import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleStatusOptionsFixture } from '../../testing/fixtures';
import { ConsoleStatusActions } from './ConsoleStatusActions';

const meta: Meta<typeof ConsoleStatusActions> = {
  title: 'Console/ConsoleStatusActions',
  component: ConsoleStatusActions,
  args: { onSetStatus: () => {}, onSetInTmuxByHuman: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleStatusActions>;

export const AllStatusOptions: Story = {
  args: { statusOptions: consoleStatusOptionsFixture },
};
