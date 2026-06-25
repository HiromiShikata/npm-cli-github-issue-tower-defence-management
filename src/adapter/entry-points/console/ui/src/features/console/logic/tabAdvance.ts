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
    const candidate = CONSOLE_TABS[index].name;
    if ((counts[candidate] ?? 0) > 0) {
      return candidate;
    }
  }
  return null;
};

export const resolveDefaultActiveTab = (
  counts: Record<ConsoleTabName, number>,
): ConsoleTabName => {
  for (const tab of CONSOLE_TABS) {
    if ((counts[tab.name] ?? 0) > 0) {
      return tab.name;
    }
  }
  return CONSOLE_TABS[0].name;
};
