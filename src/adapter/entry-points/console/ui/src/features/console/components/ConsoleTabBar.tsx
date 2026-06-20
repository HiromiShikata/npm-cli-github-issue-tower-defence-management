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
}: ConsoleTabBarProps) => (
  <nav aria-label="Console tabs" className="console-tabbar">
    {CONSOLE_TABS.map((tab) => {
      const count = counts[tab.name] ?? 0;
      const isActive = tab.name === activeTab;
      if (count === 0 && !isActive) {
        return null;
      }
      return (
        <button
          key={tab.name}
          type="button"
          className="console-tab"
          data-active={isActive ? 'true' : undefined}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onSelectTab(tab.name)}
        >
          <span className="console-tab-label">{tab.label}</span>
          <span
            className="console-tab-badge"
            data-zero={count === 0 ? 'true' : undefined}
          >
            {count}
          </span>
        </button>
      );
    })}
  </nav>
);
