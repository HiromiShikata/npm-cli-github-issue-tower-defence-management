import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CONSOLE_TABS, type ConsoleTabName } from '../types';

export type ConsoleTabBarProps = {
  activeTab: ConsoleTabName;
  onSelectTab: (tab: ConsoleTabName) => void;
};

export const ConsoleTabBar = ({
  activeTab,
  onSelectTab,
}: ConsoleTabBarProps) => (
  <nav
    aria-label="Console tabs"
    className="flex flex-wrap gap-1 border-b border-border p-2"
  >
    {CONSOLE_TABS.map((tab) => (
      <Button
        key={tab.name}
        type="button"
        size="sm"
        variant={tab.name === activeTab ? 'default' : 'ghost'}
        aria-current={tab.name === activeTab ? 'page' : undefined}
        className={cn(tab.name === activeTab && 'font-semibold')}
        onClick={() => onSelectTab(tab.name)}
      >
        {tab.label}
      </Button>
    ))}
  </nav>
);
