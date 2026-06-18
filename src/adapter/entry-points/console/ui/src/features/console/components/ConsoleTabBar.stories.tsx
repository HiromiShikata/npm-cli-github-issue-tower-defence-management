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

const fullCounts = {
  prs: 3,
  triage: 5,
  unread: 12,
  'failed-preparation': 1,
  'todo-by-human': 4,
};

export const PrsActive: Story = {
  args: {
    activeTab: 'prs',
    counts: fullCounts,
    onSelectTab: () => undefined,
  },
};

export const TriageActive: Story = {
  args: {
    activeTab: 'triage',
    counts: fullCounts,
    onSelectTab: () => undefined,
  },
};

export const ZeroCountTabsHidden: Story = {
  args: {
    activeTab: 'prs',
    counts: {
      prs: 2,
      triage: 0,
      unread: 7,
      'failed-preparation': 0,
      'todo-by-human': 0,
    },
    onSelectTab: () => undefined,
  },
};

export const ActiveTabZeroStaysVisible: Story = {
  args: {
    activeTab: 'failed-preparation',
    counts: {
      prs: 3,
      triage: 0,
      unread: 0,
      'failed-preparation': 0,
      'todo-by-human': 0,
    },
    onSelectTab: () => undefined,
  },
};

export const Interactive: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<ConsoleTabName>('prs');
    return (
      <ConsoleTabBar
        activeTab={activeTab}
        counts={fullCounts}
        onSelectTab={setActiveTab}
      />
    );
  },
};
