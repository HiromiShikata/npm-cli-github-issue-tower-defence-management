import type {
  AirplaneModeStatus,
  AirplaneSyncProgress,
} from '../../hooks/useAirplaneMode';
import { CONSOLE_TABS, type ConsoleTabName } from '../../logic/types';
import { ConsoleAirplaneModeButton } from './ConsoleAirplaneModeButton';

export type ConsoleTabBarProps = {
  activeTab: ConsoleTabName;
  counts: Record<ConsoleTabName, number>;
  pjcode: string | null;
  generatedAt: string | null;
  fromCache: boolean;
  tabHref: (tab: ConsoleTabName) => string;
  onSelectTab: (tab: ConsoleTabName) => void;
  airplaneModeStatus: AirplaneModeStatus;
  airplaneModeProgress: AirplaneSyncProgress | null;
  airplaneModeCapturedAt: string | null;
  airplaneModeFailures: string[];
  onAirplaneModeStartSync: () => void;
  onAirplaneModeTurnOff: () => void;
};

export const ConsoleTabList = ({
  activeTab,
  counts,
  pjcode,
  generatedAt,
  fromCache,
  tabHref,
  onSelectTab,
  airplaneModeStatus,
  airplaneModeProgress,
  airplaneModeCapturedAt,
  airplaneModeFailures,
  onAirplaneModeStartSync,
  onAirplaneModeTurnOff,
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
      {generatedAt !== null && airplaneModeStatus !== 'on' && (
        <span
          className="console-tab-geninfo"
          data-from-cache={fromCache ? 'true' : undefined}
        >
          {fromCache ? '(cached) ' : ''}snapshot: {generatedAt}
        </span>
      )}
      <ConsoleAirplaneModeButton
        status={airplaneModeStatus}
        progress={airplaneModeProgress}
        capturedAt={airplaneModeCapturedAt}
        failures={airplaneModeFailures}
        onStartSync={onAirplaneModeStartSync}
        onTurnOff={onAirplaneModeTurnOff}
      />
    </nav>
  );
};
