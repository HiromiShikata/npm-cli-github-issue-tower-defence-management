import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleToggleSwitch } from './ConsoleToggleSwitch';

const meta: Meta<typeof ConsoleToggleSwitch> = {
  title: 'Console/ConsoleToggleSwitch',
  component: ConsoleToggleSwitch,
  args: {
    ariaLabel: 'Timer Mode',
    onChange: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleToggleSwitch>;

export const Off: Story = {
  args: {
    checked: false,
  },
};

export const On: Story = {
  args: {
    checked: true,
  },
};
