import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleProjectTimerBar } from './ConsoleProjectTimerBar';

const TOTAL_SECONDS = 1800;

const nowAtStart = new Date('2026-08-30T10:00:00.000Z').getTime();
const endsAt = new Date(nowAtStart + TOTAL_SECONDS * 1000).toISOString();

const meta: Meta<typeof ConsoleProjectTimerBar> = {
  title: 'Console/ConsoleProjectTimerBar',
  component: ConsoleProjectTimerBar,
  args: {
    timerEndsAt: endsAt,
    timerTotalSeconds: TOTAL_SECONDS,
    now: nowAtStart,
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleProjectTimerBar>;

export const FullTime: Story = {
  args: {
    now: nowAtStart,
  },
};

export const HalfElapsed: Story = {
  args: {
    now: nowAtStart + 900 * 1000,
  },
};

export const AlmostExpired: Story = {
  args: {
    now: nowAtStart + 1740 * 1000,
  },
};

export const Expired: Story = {
  args: {
    now: nowAtStart + TOTAL_SECONDS * 1000 + 30 * 1000,
  },
};

export const NoTimer: Story = {
  args: {
    timerEndsAt: null,
    timerTotalSeconds: null,
  },
};
