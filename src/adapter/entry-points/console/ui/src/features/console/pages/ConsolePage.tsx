import { useState } from 'react';
import { ConsoleListView } from '../components/ConsoleListView';
import { ConsoleTabBar } from '../components/ConsoleTabBar';
import { useConsoleList } from '../hooks/useConsoleList';
import { CONSOLE_TABS, type ConsoleTabName } from '../types';

export const ConsolePage = () => {
  const [activeTab, setActiveTab] = useState<ConsoleTabName>(
    CONSOLE_TABS[0].name,
  );
  const { items, isLoading, error } = useConsoleList(activeTab);

  return (
    <main className="mx-auto flex max-w-3xl flex-col">
      <ConsoleTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      <ConsoleListView items={items} isLoading={isLoading} error={error} />
    </main>
  );
};
