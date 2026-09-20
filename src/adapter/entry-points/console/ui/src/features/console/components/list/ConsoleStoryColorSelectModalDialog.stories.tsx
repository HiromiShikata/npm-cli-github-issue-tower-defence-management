import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleStoryColorSelectModalDialog } from './ConsoleStoryColorSelectModalDialog';

const meta: Meta<typeof ConsoleStoryColorSelectModalDialog> = {
  title: 'Console/ConsoleStoryColorSelectModalDialog',
  component: ConsoleStoryColorSelectModalDialog,
  args: {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    onSelectColor: () => undefined,
    onClose: () => undefined,
    disabled: false,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleStoryColorSelectModalDialog>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
