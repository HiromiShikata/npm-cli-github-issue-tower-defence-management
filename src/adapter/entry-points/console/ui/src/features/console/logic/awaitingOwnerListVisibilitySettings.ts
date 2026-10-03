export type AwaitingOwnerListVisibilitySettings = {
  showExecutiveSummaryAndActionButton: boolean;
};

export const AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY =
  'tdpm-awaiting-owner-list-visibility-settings';

const defaultSettings = (): AwaitingOwnerListVisibilitySettings => ({
  showExecutiveSummaryAndActionButton: true,
});

export const readAwaitingOwnerListVisibilitySettings =
  (): AwaitingOwnerListVisibilitySettings => {
    if (typeof localStorage === 'undefined') {
      return defaultSettings();
    }
    const raw = localStorage.getItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
    );
    if (raw === null) {
      return defaultSettings();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        return defaultSettings();
      }
      const record = parsed as Record<string, unknown>;
      const showExecutiveSummaryAndActionButton =
        typeof record.showExecutiveSummaryAndActionButton === 'boolean'
          ? record.showExecutiveSummaryAndActionButton
          : true;
      return { showExecutiveSummaryAndActionButton };
    } catch {
      return defaultSettings();
    }
  };

export const writeAwaitingOwnerListVisibilitySettings = (
  settings: AwaitingOwnerListVisibilitySettings,
): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
      JSON.stringify(settings),
    );
  }
};
