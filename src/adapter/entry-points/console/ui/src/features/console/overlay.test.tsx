import { consoleListItemsFixture } from './fixtures';
import {
  countPendingItems,
  isItemProcessed,
  markItemProcessed,
  overlayKeyForItem,
  subtractProcessedItems,
} from './overlay';

describe('overlay processing', () => {
  const [first, second] = consoleListItemsFixture;

  it('keys an item by its project item id', () => {
    expect(overlayKeyForItem(first)).toBe(first.projectItemId);
  });

  it('keys by issue number when the project item id is empty', () => {
    const item = { ...first, projectItemId: '' };
    expect(overlayKeyForItem(item)).toBe(String(item.number));
  });

  it('marks an item processed and reports it as processed', () => {
    const overlay = markItemProcessed({}, first);
    expect(isItemProcessed(overlay, first)).toBe(true);
    expect(isItemProcessed(overlay, second)).toBe(false);
  });

  it('subtracts processed items from a list', () => {
    const overlay = markItemProcessed({}, first);
    expect(
      subtractProcessedItems(consoleListItemsFixture, overlay),
    ).not.toContain(first);
  });

  it('counts only the pending items after subtraction', () => {
    const overlay = markItemProcessed(markItemProcessed({}, first), second);
    expect(countPendingItems(consoleListItemsFixture, overlay)).toBe(
      consoleListItemsFixture.length - 2,
    );
  });
});
