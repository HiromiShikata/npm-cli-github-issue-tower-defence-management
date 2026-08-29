import {
  type ConsoleListRow,
  resolveStoryColorEnum,
} from '../../logic/grouping';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryColorSource,
} from '../../logic/types';
import { ConsoleQueuedItemRow } from './ConsoleQueuedItemRow';
import { ConsoleStorySummary } from './ConsoleStorySummary';

export type ConsoleQueuedListProps = {
  rows: ConsoleListRow[];
  storyColors: ConsoleStoryColorSource;
  statusOptions: ConsoleFieldOption[];
  agentOptions: ConsoleFieldOption[];
  activeItemId: string | null;
  isLoading: boolean;
  error: string | null;
  onSelectItem: (item: ConsoleListItem) => void;
};

export const ConsoleQueuedList = ({
  rows,
  storyColors,
  statusOptions,
  agentOptions,
  activeItemId,
  isLoading,
  error,
  onSelectItem,
}: ConsoleQueuedListProps) => {
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
    return <p className="console-list-empty">No items</p>;
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
            <ConsoleQueuedItemRow
              item={row.item}
              isActive={row.item.itemId === activeItemId}
              statusOptions={statusOptions}
              agentOptions={agentOptions}
              onSelect={onSelectItem}
            />
          </li>
        ),
      )}
    </ul>
  );
};
