export type ActiveTabListState =
  'not-loaded' | 'loaded-from-cache' | 'loaded-live';

export const openTaskKeyResolve = (
  selectedItemKey: string | null,
  activeTabListState: ActiveTabListState,
  selectedItemIsInActiveTabList: boolean,
): string | null => {
  if (selectedItemKey === null) {
    return null;
  }
  if (activeTabListState !== 'loaded-live') {
    return selectedItemKey;
  }
  return selectedItemIsInActiveTabList ? selectedItemKey : null;
};
