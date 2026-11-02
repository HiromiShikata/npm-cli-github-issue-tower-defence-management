import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryStatusFilter } from './ConsoleStoryStatusFilter';

const meta: Meta<typeof ConsoleStoryStatusFilter> = {
  title: 'Console/ConsoleStoryStatusFilter',
  component: ConsoleStoryStatusFilter,
  args: {
    statusNames: ['Unread', 'In Tmux by agent', 'Done'],
    selectedStatuses: [],
    onToggleStatus: () => undefined,
    onClearStatuses: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryStatusFilter>;

export const NoneSelected: Story = {};

export const SeveralSelected: Story = {
  args: {
    selectedStatuses: ['Unread', 'Done'],
  },
};
