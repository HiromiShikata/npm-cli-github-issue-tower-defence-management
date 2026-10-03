import {
  AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
  readAwaitingOwnerListVisibilitySettings,
  writeAwaitingOwnerListVisibilitySettings,
} from './awaitingOwnerListVisibilitySettings';

describe('readAwaitingOwnerListVisibilitySettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes the storage key as tdpm-awaiting-owner-list-visibility-settings', () => {
    expect(AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY).toBe(
      'tdpm-awaiting-owner-list-visibility-settings',
    );
  });

  it('defaults showExecutiveSummaryAndActionButton to true when nothing was ever saved', () => {
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: true,
    });
  });

  it('round-trips a previously written false value', () => {
    writeAwaitingOwnerListVisibilitySettings({
      showExecutiveSummaryAndActionButton: false,
    });
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: false,
    });
  });

  it('round-trips a previously written true value', () => {
    writeAwaitingOwnerListVisibilitySettings({
      showExecutiveSummaryAndActionButton: true,
    });
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: true,
    });
  });

  it('defaults to true when the stored JSON cannot be parsed', () => {
    localStorage.setItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
      '{not valid json',
    );
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: true,
    });
  });

  it('defaults to true when showExecutiveSummaryAndActionButton is not a boolean', () => {
    localStorage.setItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
      JSON.stringify({ showExecutiveSummaryAndActionButton: 'off' }),
    );
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: true,
    });
  });

  it('defaults to true when the stored JSON is an array rather than an object', () => {
    localStorage.setItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
      JSON.stringify([true]),
    );
    expect(readAwaitingOwnerListVisibilitySettings()).toEqual({
      showExecutiveSummaryAndActionButton: true,
    });
  });
});

describe('writeAwaitingOwnerListVisibilitySettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes the setting to the tdpm-awaiting-owner-list-visibility-settings localStorage key', () => {
    writeAwaitingOwnerListVisibilitySettings({
      showExecutiveSummaryAndActionButton: false,
    });
    const stored = localStorage.getItem(
      AWAITING_OWNER_LIST_VISIBILITY_SETTINGS_KEY,
    );
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      showExecutiveSummaryAndActionButton: false,
    });
  });
});
