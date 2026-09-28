import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleFieldOption } from '../../logic/types';
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

const duplicateNameAgentOptionsFixture: ConsoleFieldOption[] = [
  { id: '95c55dd3', name: 'developer', color: 'GRAY' },
  { id: 'a1b2c3d4', name: 'developer', color: 'BLUE' },
];

export const ResolvesDuplicateNameByOptionId: Story = {
  args: {
    agentOptions: duplicateNameAgentOptionsFixture,
    currentAgentName: 'developer',
    currentAgentOptionId: 'a1b2c3d4',
  },
};
