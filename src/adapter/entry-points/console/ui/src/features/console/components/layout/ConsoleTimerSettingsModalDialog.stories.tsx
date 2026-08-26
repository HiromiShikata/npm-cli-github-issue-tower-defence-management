import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleTimerSettingsModalDialog } from './ConsoleTimerSettingsModalDialog';

const meta: Meta<typeof ConsoleTimerSettingsModalDialog> = {
  title: 'Console/ConsoleTimerSettingsModalDialog',
  component: ConsoleTimerSettingsModalDialog,
  args: {
    pjcodes: ['acme', 'beta'],
    isLoadingPjcodes: false,
    projectMinutes: { acme: 25, beta: 0 },
    timerMode: false,
    onOpen: () => {},
    onToggleTimerMode: () => {},
    onChangeMinutes: () => {},
    onSave: () => {},
    onClose: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleTimerSettingsModalDialog>;

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const OpenLoading: Story = {
  args: {
    isOpen: true,
    isLoadingPjcodes: true,
  },
};

export const OpenTimerOff: Story = {
  args: {
    isOpen: true,
    timerMode: false,
  },
};

export const OpenTimerOn: Story = {
  args: {
    isOpen: true,
    timerMode: true,
  },
};
