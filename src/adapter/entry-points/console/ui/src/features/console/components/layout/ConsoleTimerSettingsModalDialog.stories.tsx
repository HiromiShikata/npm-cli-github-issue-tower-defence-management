import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ConsoleTimerHeaderView } from '../../logic/consoleTimerHeader';
import { ConsoleTimerSettingsModalDialog } from './ConsoleTimerSettingsModalDialog';

const meta: Meta<typeof ConsoleTimerSettingsModalDialog> = {
  title: 'Console/ConsoleTimerSettingsModalDialog',
  component: ConsoleTimerSettingsModalDialog,
  args: {
    isTimerActive: false,
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

const normalView: ConsoleTimerHeaderView = {
  tone: 'normal',
  timeText: '12:34',
  nextText: 'beta',
};

export const Closed: Story = {
  args: {
    isOpen: false,
  },
};

export const ClosedTimerActive: Story = {
  args: {
    isOpen: false,
    isTimerActive: true,
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

export const OpenWithUnconfiguredProject: Story = {
  args: {
    isOpen: true,
    timerMode: true,
    pjcodes: ['acme', 'beta', 'gamma'],
    projectMinutes: { acme: 25 },
  },
};

export const OpenWithNoStoredSettings: Story = {
  args: {
    isOpen: true,
    timerMode: false,
    pjcodes: ['acme', 'beta', 'gamma'],
    projectMinutes: {},
  },
};

export const Off: Story = {
  args: { isOpen: false, timerMode: false, isTimerActive: false },
};

export const Counting: Story = {
  args: {
    isOpen: false,
    timerMode: true,
    isTimerActive: true,
    timerHeaderView: normalView,
  },
};

export const LastMinute: Story = {
  args: {
    isOpen: false,
    timerMode: true,
    isTimerActive: true,
    timerHeaderView: { tone: 'warning', timeText: '00:42', nextText: 'beta' },
  },
};

export const Expired: Story = {
  args: {
    isOpen: false,
    timerMode: true,
    isTimerActive: true,
    timerHeaderView: {
      tone: 'danger',
      timeText: 'next submit',
      nextText: 'beta',
    },
  },
};

export const NoNext: Story = {
  args: {
    isOpen: false,
    timerMode: true,
    isTimerActive: true,
    timerHeaderView: { tone: 'muted', timeText: '12:34', nextText: 'none' },
  },
};
