import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import type { ConsoleTabName } from '../../logic/types';
import { ConsoleTabList } from './ConsoleTabList';

const allPjcodes = ['acme', 'beta', 'gamma', 'delta', 'epsilon'];

const meta: Meta<typeof ConsoleTabList> = {
  title: 'Console/ConsoleTabList',
  component: ConsoleTabList,
  args: {
    pjcode: 'acme',
    pjcodes: allPjcodes,
    generatedAt: '2026-06-19T08:42:11.000Z',
    fromCache: false,
    tabHref: (tab: ConsoleTabName) => `/projects/acme/${tab}`,
    onSelectTab: () => {},
    onSelectProject: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ConsoleTabList>;

const counts: Record<ConsoleTabName, number> = {
  'workflow-blocker': 5,
  prs: 35,
  'failed-preparation': 2,
  'todo-by-human': 66,
  'todo-by-agent': 24,
  stories: 3,
};

export const AllTabsWithCounts: Story = {
  args: {
    activeTab: 'prs',
    counts,
  },
};

export const ZeroCountTabsHidden: Story = {
  args: {
    activeTab: 'prs',
    counts: {
      'workflow-blocker': 0,
      prs: 35,
      'failed-preparation': 0,
      'todo-by-human': 18,
      'todo-by-agent': 0,
      stories: 0,
    },
  },
};

export const ZeroCountActiveTabStaysVisible: Story = {
  args: {
    activeTab: 'failed-preparation',
    counts: {
      'workflow-blocker': 0,
      prs: 35,
      'failed-preparation': 0,
      'todo-by-human': 18,
      'todo-by-agent': 0,
      stories: 0,
    },
  },
};

export const AfterAutoAdvanceToNextTab: Story = {
  args: {
    activeTab: 'failed-preparation',
    counts: {
      'workflow-blocker': 0,
      prs: 0,
      'failed-preparation': 2,
      'todo-by-human': 4,
      'todo-by-agent': 0,
      stories: 0,
    },
    onSelectTab: () => {},
  },
};

export const CachedSnapshot: Story = {
  args: {
    activeTab: 'prs',
    counts,
    fromCache: true,
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

export const WithSettingsButton: Story = {
  args: {
    activeTab: 'prs',
    counts,
    settingsButton: (
      <button
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8b949e',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '4px 8px',
        }}
        aria-label="Console Settings"
      >
        ⚙
      </button>
    ),
  },
};

export const WithProjectSwitcherClosed: Story = {
  args: {
    activeTab: 'prs',
    counts,
    pjcode: 'acme',
    pjcodes: allPjcodes,
  },
};

const DropdownOpen = (args: ComponentProps<typeof ConsoleTabList>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const btn = containerRef.current?.querySelector<HTMLButtonElement>(
      '.console-tab-pjname-button',
    );
    btn?.click();
  }, []);
  return (
    <div ref={containerRef}>
      <ConsoleTabList {...args} />
    </div>
  );
};

export const WithProjectSwitcherOpen: Story = {
  args: {
    activeTab: 'prs',
    counts,
    pjcode: 'acme',
    pjcodes: allPjcodes,
  },
  render: (args) => <DropdownOpen {...args} />,
};
