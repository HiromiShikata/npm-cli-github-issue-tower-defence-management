import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ConsoleTabName } from '../types';
import { ConsoleTabBar } from './ConsoleTabBar';

const meta: Meta<typeof ConsoleTabBar> = {
  title: 'Console/ConsoleTabBar',
  component: ConsoleTabBar,
};

export default meta;

type Story = StoryObj<typeof ConsoleTabBar>;

const counts: Record<ConsoleTabName, number> = {
  prs: 35,
  triage: 12,
  unread: 7,
  'failed-preparation': 2,
  'todo-by-human': 4,
};

export const AllTabsWithCounts: Story = {
  args: {
    activeTab: 'prs',
    counts,
    onSelectTab: () => {},
  },
};

export const ZeroCountTabsHidden: Story = {
  args: {
    activeTab: 'prs',
    counts: {
      prs: 35,
      triage: 0,
      unread: 7,
      'failed-preparation': 0,
      'todo-by-human': 0,
    },
    onSelectTab: () => {},
  },
};

export const ActiveZeroCountTabStaysVisible: Story = {
  args: {
    activeTab: 'triage',
    counts: {
      prs: 35,
      triage: 0,
      unread: 7,
      'failed-preparation': 0,
      'todo-by-human': 0,
    },
    onSelectTab: () => {},
  },
};

export const Interactive: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<ConsoleTabName>('prs');
    return (
      <ConsoleTabBar
        activeTab={activeTab}
        counts={counts}
        onSelectTab={setActiveTab}
      />
    );
  },
};
