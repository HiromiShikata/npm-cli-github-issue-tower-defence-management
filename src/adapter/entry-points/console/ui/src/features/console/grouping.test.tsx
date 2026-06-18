import { consoleListItemsFixture } from './fixtures';
import { groupItemsByStoryOrder, NO_STORY_LABEL } from './grouping';
import type { ConsoleListItem } from './types';

describe('groupItemsByStoryOrder', () => {
  it('preserves array order and inserts a group when the story changes', () => {
    const groups = groupItemsByStoryOrder(consoleListItemsFixture, {
      'TDPM Console port': 'BLUE',
      'regular / workflow improvement': 'GREEN',
    });
    expect(groups.map((group) => group.story)).toEqual([
      'TDPM Console port',
      'regular / workflow improvement',
    ]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(2);
  });

  it('does not re-sort items that share a story but are separated in the array', () => {
    const items: ConsoleListItem[] = [
      { ...consoleListItemsFixture[2], story: 'Alpha' },
      { ...consoleListItemsFixture[0], story: 'Beta' },
      { ...consoleListItemsFixture[1], story: 'Alpha' },
    ];
    const groups = groupItemsByStoryOrder(items, {});
    expect(groups.map((group) => group.story)).toEqual([
      'Alpha',
      'Beta',
      'Alpha',
    ]);
  });

  it('labels items without a story as the no-story group', () => {
    const groups = groupItemsByStoryOrder(
      [{ ...consoleListItemsFixture[0], story: '' }],
      {},
    );
    expect(groups[0].story).toBe(NO_STORY_LABEL);
  });

  it('resolves the group color from the story color map and falls back to GRAY', () => {
    const groups = groupItemsByStoryOrder(
      [
        { ...consoleListItemsFixture[0], story: 'Known' },
        { ...consoleListItemsFixture[1], story: 'Unknown' },
      ],
      { Known: 'RED' },
    );
    expect(groups[0].color).toBe('RED');
    expect(groups[1].color).toBe('GRAY');
  });
});
