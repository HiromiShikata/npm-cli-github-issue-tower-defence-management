import { useMemo } from 'react';
import { groupItemsByStoryOrder } from '../grouping';
import type { ConsoleColor, ConsoleListItem } from '../types';
import { ConsoleItemRow } from './ConsoleItemRow';
import { ConsoleStoryGroupHeader } from './ConsoleStoryGroupHeader';

export type ConsoleListViewProps = {
  items: ConsoleListItem[];
  storyColors: Record<string, ConsoleColor>;
  selectedItemId: string | null;
  onSelectItem: (item: ConsoleListItem) => void;
  isLoading: boolean;
  error: string | null;
};

export const ConsoleListView = ({
  items,
  storyColors,
  selectedItemId,
  onSelectItem,
  isLoading,
  error,
}: ConsoleListViewProps) => {
  const groups = useMemo(
    () => groupItemsByStoryOrder(items, storyColors),
    [items, storyColors],
  );

  if (error !== null) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        Failed to load list: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading list…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No items in this tab.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.story}>
          <ConsoleStoryGroupHeader
            story={group.story}
            color={group.color}
            count={group.items.length}
          />
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <li key={item.itemId}>
                <ConsoleItemRow
                  item={item}
                  isSelected={item.itemId === selectedItemId}
                  onSelect={onSelectItem}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
