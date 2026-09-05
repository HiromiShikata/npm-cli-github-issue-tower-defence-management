import type { Meta, StoryObj } from '@storybook/react-vite';
import { consoleAgentOptionsFixture } from '../../testing/fixtures';
import { ConsoleAgentSelectActions } from './ConsoleAgentSelectActions';

const meta: Meta<typeof ConsoleAgentSelectActions> = {
  title: 'Console/ConsoleAgentSelectActions',
  component: ConsoleAgentSelectActions,
  args: { onSetAgent: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleAgentSelectActions>;

export const NoCurrentAgent: Story = {
  args: {
    agentOptions: consoleAgentOptionsFixture,
    currentAgentName: null,
  },
};

export const WithCurrentAgent: Story = {
  args: {
    agentOptions: consoleAgentOptionsFixture,
    currentAgentName: 'developer',
  },
};

export const EmptyOptions: Story = {
  args: {
    agentOptions: [],
    currentAgentName: null,
  },
};
