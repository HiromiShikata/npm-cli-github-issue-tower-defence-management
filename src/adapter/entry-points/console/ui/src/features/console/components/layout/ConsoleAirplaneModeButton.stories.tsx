import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleAirplaneModeButton } from './ConsoleAirplaneModeButton';

const meta: Meta<typeof ConsoleAirplaneModeButton> = {
  title: 'Console/ConsoleAirplaneModeButton',
  component: ConsoleAirplaneModeButton,
  args: {
    status: 'off',
    progress: null,
    capturedAt: null,
    failures: [],
    onStartSync: () => {},
    onTurnOff: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleAirplaneModeButton>;

export const Off: Story = {
  args: {
    status: 'off',
  },
};

export const SyncingNoProgress: Story = {
  args: {
    status: 'syncing',
    progress: { fetched: 0, total: 0 },
  },
};

export const SyncingWithProgress: Story = {
  args: {
    status: 'syncing',
    progress: { fetched: 127, total: 557 },
  },
};

export const On: Story = {
  args: {
    status: 'on',
    capturedAt: '2026-08-18T11:30:00Z',
  },
};

export const SyncError: Story = {
  args: {
    status: 'error',
    failures: [
      'https://github.com/owner/repo/issues/99',
      'https://github.com/owner/repo/pull/100',
    ],
  },
};
