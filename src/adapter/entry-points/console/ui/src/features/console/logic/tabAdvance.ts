import type { ConsoleTabName } from './types';
import { CONSOLE_TABS } from './types';

export const findNextNonEmptyTabToRight = (
  activeTab: ConsoleTabName,
  counts: Record<ConsoleTabName, number>,
): ConsoleTabName | null => {
  const activeIndex = CONSOLE_TABS.findIndex((tab) => tab.name === activeTab);
  if (activeIndex === -1) {
    return null;
  }
  for (let index = activeIndex + 1; index < CONSOLE_TABS.length; index += 1) {
    const tab = CONSOLE_TABS[index];
    if (tab.isNavigable === false) {
      continue;
    }
    if ((counts[tab.name] ?? 0) > 0) {
      return tab.name;
    }
  }
  return null;
};

export const resolveDefaultActiveTab = (
  counts: Record<ConsoleTabName, number>,
): ConsoleTabName => {
  const navigableTabs = CONSOLE_TABS.filter((tab) => tab.isNavigable !== false);
  for (const tab of navigableTabs) {
    if ((counts[tab.name] ?? 0) > 0) {
      return tab.name;
    }
  }
  return navigableTabs[0].name;
};
