import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CONSOLE_TABS, type ConsoleTabName } from '../types';

export type ConsoleTabBarProps = {
  activeTab: ConsoleTabName;
  counts: Record<ConsoleTabName, number>;
  onSelectTab: (tab: ConsoleTabName) => void;
};

export const ConsoleTabBar = ({
  activeTab,
  counts,
  onSelectTab,
}: ConsoleTabBarProps) => {
  const visibleTabs = CONSOLE_TABS.filter(
    (tab) => counts[tab.name] > 0 || tab.name === activeTab,
  );

  return (
    <nav
      aria-label="Console tabs"
      className="flex flex-wrap gap-1 border-b border-border p-2"
    >
      {visibleTabs.map((tab) => {
        const isActive = tab.name === activeTab;
        return (
          <Button
            key={tab.name}
            type="button"
            size="sm"
            variant={isActive ? 'default' : 'ghost'}
            aria-current={isActive ? 'page' : undefined}
            className={cn('gap-2', isActive && 'font-semibold')}
            onClick={() => onSelectTab(tab.name)}
          >
            {tab.label}
            <Badge variant={isActive ? 'secondary' : 'outline'}>
              {counts[tab.name]}
            </Badge>
          </Button>
        );
      })}
    </nav>
  );
};
