import {
  type ConsoleListRow,
  resolveStoryColorEnum,
} from '../../logic/grouping';
import type {
  ConsoleListItem,
  ConsoleStoryColorSource,
} from '../../logic/types';
import { ConsoleItemSummary } from './ConsoleItemSummary';
import { ConsoleStorySummary } from './ConsoleStorySummary';

export type ConsoleListViewProps = {
  rows: ConsoleListRow[];
  storyColors: ConsoleStoryColorSource;
  activeItemId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectItem: (item: ConsoleListItem) => void;
};

export const ConsoleItemList = ({
  rows,
  storyColors,
  activeItemId,
  isLoading,
  error,
  onSelectItem,
}: ConsoleListViewProps) => {
  if (error !== null) {
    return (
      <p role="alert" className="console-list-message console-list-error">
        Failed to load list: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-list-message">Loading list...</p>;
  }

  if (rows.length === 0) {
    return <p className="console-list-message">No items.</p>;
  }

  return (
    <ul className="console-list">
      {rows.map((row) =>
        row.kind === 'group-header' ? (
          <li key={`group:${row.story}`} className="console-list-group">
            <ConsoleStorySummary
              story={row.story}
              count={row.count}
              colorEnum={resolveStoryColorEnum(storyColors, row.story)}
            />
          </li>
        ) : (
          <li key={row.item.itemId} className="console-list-row">
            <ConsoleItemSummary
              item={row.item}
              isActive={row.item.itemId === activeItemId}
              onSelect={onSelectItem}
            />
          </li>
        ),
      )}
    </ul>
  );
};
