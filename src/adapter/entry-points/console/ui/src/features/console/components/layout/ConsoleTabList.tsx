import { CONSOLE_TABS, type ConsoleTabName } from '../../logic/types';

export type ConsoleTabBarProps = {
  activeTab: ConsoleTabName;
  counts: Record<ConsoleTabName, number>;
  pjcode: string | null;
  generatedAt: string | null;
  tabHref: (tab: ConsoleTabName) => string;
  onSelectTab: (tab: ConsoleTabName) => void;
};

export const ConsoleTabList = ({
  activeTab,
  counts,
  pjcode,
  generatedAt,
  tabHref,
  onSelectTab,
}: ConsoleTabBarProps) => {
  return (
    <nav aria-label="Console tabs" className="console-tabbar">
      {CONSOLE_TABS.filter((tab) => {
        const count = counts[tab.name] ?? 0;
        return count > 0 || tab.name === activeTab;
      }).map((tab) => {
        const count = counts[tab.name] ?? 0;
        const isActive = tab.name === activeTab;
        return (
          <a
            key={tab.name}
            href={tabHref(tab.name)}
            className="console-tab"
            data-active={isActive ? 'true' : undefined}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onSelectTab(tab.name);
            }}
          >
            <span className="console-tab-label">{tab.label}</span>
            <span
              className="console-tab-badge"
              data-zero={count === 0 ? 'true' : undefined}
            >
              {count}
            </span>
          </a>
        );
      })}
      {pjcode !== null && <span className="console-tab-pjname">{pjcode}</span>}
      {generatedAt !== null && (
        <span className="console-tab-geninfo">snapshot: {generatedAt}</span>
      )}
    </nav>
  );
};
