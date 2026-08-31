import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleRareActions } from './ConsoleRareActions';

const meta: Meta<typeof ConsoleRareActions> = {
  title: 'Console/ConsoleRareActions',
  component: ConsoleRareActions,
};

export default meta;

type Story = StoryObj<typeof ConsoleRareActions>;

export const WithDependedIssueUrl: Story = {
  args: {
    onSetDependedIssueUrl: async () => {},
  },
};

export const Disabled: Story = {
  args: {
    onSetDependedIssueUrl: null,
  },
};
