import {
  type ActiveTabListState,
  openTaskKeyResolve,
} from './openTaskKeyResolve';

type OpenTaskKeyResolveCase = {
  description: string;
  selectedItemKey: string | null;
  activeTabListState: ActiveTabListState;
  selectedItemIsInActiveTabList: boolean;
  expectedOpenTaskKey: string | null;
};

describe('openTaskKeyResolve', () => {
  it('openTaskKeyResolve returns the selected key unless a live active tab list no longer contains the selected item', () => {
    const cases: OpenTaskKeyResolveCase[] = [
      {
        description: 'no selected key with a live list that lacks the item',
        selectedItemKey: null,
        activeTabListState: 'loaded-live',
        selectedItemIsInActiveTabList: false,
        expectedOpenTaskKey: null,
      },
      {
        description: 'no selected key with a list that is not loaded',
        selectedItemKey: null,
        activeTabListState: 'not-loaded',
        selectedItemIsInActiveTabList: false,
        expectedOpenTaskKey: null,
      },
      {
        description: 'selected key with a list that is not loaded',
        selectedItemKey: 'item-1',
        activeTabListState: 'not-loaded',
        selectedItemIsInActiveTabList: false,
        expectedOpenTaskKey: 'item-1',
      },
      {
        description: 'selected key with a cached list that lacks the item',
        selectedItemKey: 'item-1',
        activeTabListState: 'loaded-from-cache',
        selectedItemIsInActiveTabList: false,
        expectedOpenTaskKey: 'item-1',
      },
      {
        description: 'selected key with a cached list that contains the item',
        selectedItemKey: 'item-1',
        activeTabListState: 'loaded-from-cache',
        selectedItemIsInActiveTabList: true,
        expectedOpenTaskKey: 'item-1',
      },
      {
        description: 'selected key with a live list that contains the item',
        selectedItemKey: 'item-1',
        activeTabListState: 'loaded-live',
        selectedItemIsInActiveTabList: true,
        expectedOpenTaskKey: 'item-1',
      },
      {
        description: 'selected key with a live list that lacks the item',
        selectedItemKey: 'item-1',
        activeTabListState: 'loaded-live',
        selectedItemIsInActiveTabList: false,
        expectedOpenTaskKey: null,
      },
    ];

    const actualResults = cases.map((testCase) => ({
      description: testCase.description,
      openTaskKey: openTaskKeyResolve(
        testCase.selectedItemKey,
        testCase.activeTabListState,
        testCase.selectedItemIsInActiveTabList,
      ),
    }));

    expect(actualResults).toEqual(
      cases.map((testCase) => ({
        description: testCase.description,
        openTaskKey: testCase.expectedOpenTaskKey,
      })),
    );
  });
});
