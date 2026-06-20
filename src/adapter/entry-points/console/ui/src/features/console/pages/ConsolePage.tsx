import { useState } from 'react';
import { ConsoleListView } from '../components/ConsoleListView';
import { ConsoleProjectHeader } from '../components/ConsoleProjectHeader';
import { ConsoleTabBar } from '../components/ConsoleTabBar';
import { useConsoleList } from '../hooks/useConsoleList';
import { useConsolePjcode } from '../hooks/useConsolePjcode';
import { CONSOLE_TABS, type ConsoleTabName } from '../types';

export const ConsolePage = () => {
  const pjcode = useConsolePjcode();
  const [activeTab, setActiveTab] = useState<ConsoleTabName>(
    CONSOLE_TABS[0].name,
  );
  const { items, isLoading, error } = useConsoleList(pjcode, activeTab);

  return (
    <main className="mx-auto flex max-w-3xl flex-col">
      <ConsoleProjectHeader pjcode={pjcode} />
      <ConsoleTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      <ConsoleListView items={items} isLoading={isLoading} error={error} />
    </main>
  );
};
