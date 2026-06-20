import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCloseActions } from './ConsoleCloseActions';

const meta: Meta<typeof ConsoleCloseActions> = {
  title: 'Console/ConsoleCloseActions',
  component: ConsoleCloseActions,
  args: { onClose: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleCloseActions>;

export const Default: Story = {};
