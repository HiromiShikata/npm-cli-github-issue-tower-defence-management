import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleCloseButtonGroup } from './ConsoleCloseButtonGroup';

const meta: Meta<typeof ConsoleCloseButtonGroup> = {
  title: 'Console/ConsoleCloseButtonGroup',
  component: ConsoleCloseButtonGroup,
  args: { onClose: () => {} },
};

export default meta;

type Story = StoryObj<typeof ConsoleCloseButtonGroup>;

export const Default: Story = {};
