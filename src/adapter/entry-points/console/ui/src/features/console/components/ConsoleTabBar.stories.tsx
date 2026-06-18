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

export const PrsActive: Story = {
  args: {
    activeTab: 'prs',
    onSelectTab: () => undefined,
  },
};

export const TriageActive: Story = {
  args: {
    activeTab: 'triage',
    onSelectTab: () => undefined,
  },
};

export const Interactive: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<ConsoleTabName>('prs');
    return <ConsoleTabBar activeTab={activeTab} onSelectTab={setActiveTab} />;
  },
};
