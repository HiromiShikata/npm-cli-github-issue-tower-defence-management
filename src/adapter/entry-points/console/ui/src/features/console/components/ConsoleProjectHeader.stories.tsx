import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleProjectHeader } from './ConsoleProjectHeader';

const meta: Meta<typeof ConsoleProjectHeader> = {
  title: 'Console/ConsoleProjectHeader',
  component: ConsoleProjectHeader,
};

export default meta;

type Story = StoryObj<typeof ConsoleProjectHeader>;

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
