import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsolePanel } from './ConsolePanel';

const meta: Meta<typeof ConsolePanel> = {
  title: 'Console/ConsolePanel',
  component: ConsolePanel,
};

export default meta;

type Story = StoryObj<typeof ConsolePanel>;

export const Expanded: Story = {
  args: {
    title: 'Description',
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};

export const Collapsed: Story = {
  args: {
    title: 'Commits',
    defaultCollapsed: true,
    children: <p style={{ padding: 12 }}>Panel body content</p>,
  },
};
