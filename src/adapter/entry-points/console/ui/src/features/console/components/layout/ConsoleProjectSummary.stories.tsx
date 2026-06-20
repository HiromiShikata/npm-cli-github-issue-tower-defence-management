import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleProjectSummary } from './ConsoleProjectSummary';

const meta: Meta<typeof ConsoleProjectSummary> = {
  title: 'Console/ConsoleProjectSummary',
  component: ConsoleProjectSummary,
};

export default meta;

type Story = StoryObj<typeof ConsoleProjectSummary>;

export const WithProject: Story = {
  args: {
    pjcode: 'umino',
  },
};

export const AnotherProject: Story = {
  args: {
    pjcode: 'xmile',
  },
};

export const NoProject: Story = {
  args: {
    pjcode: null,
  },
};
