import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ConsoleTabName } from '../../logic/types';
import { ConsoleTabList } from './ConsoleTabList';

const meta: Meta<typeof ConsoleTabList> = {
  title: 'Console/ConsoleTabList',
  component: ConsoleTabList,
  args: {
    pjcode: 'umino',
    generatedAt: '2026-06-19T08:42:11.000Z',
    tabHref: (tab: ConsoleTabName) => `/projects/umino/${tab}`,
    onSelectTab: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleTabList>;

const counts: Record<ConsoleTabName, number> = {
  prs: 35,
  triage: 132,
  unread: 18,
  'failed-preparation': 2,
  'todo-by-human': 66,
};

export const AllTabsWithCounts: Story = {
  args: {
    activeTab: 'prs',
    counts,
  },
};

export const ZeroCountTabsStillShown: Story = {
  args: {
    activeTab: 'prs',
    counts: {
      prs: 35,
      triage: 0,
      unread: 18,
      'failed-preparation': 0,
      'todo-by-human': 0,
    },
  },
};

export const ZeroCountActiveTab: Story = {
  args: {
    activeTab: 'failed-preparation',
    counts: {
      prs: 35,
      triage: 132,
      unread: 18,
      'failed-preparation': 0,
      'todo-by-human': 66,
    },
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [activeTab, setActiveTab] = useState<ConsoleTabName>('prs');
    return (
      <ConsoleTabList
        {...args}
        activeTab={activeTab}
        counts={counts}
        onSelectTab={setActiveTab}
      />
    );
  },
};
