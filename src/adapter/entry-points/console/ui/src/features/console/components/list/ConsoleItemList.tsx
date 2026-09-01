import {
  type ConsoleListRow,
  resolveStoryColorEnum,
} from '../../logic/grouping';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryColorSource,
} from '../../logic/types';
import { ConsoleOkAndAwaitingWorkspaceActions } from '../operations/ConsoleOkAndAwaitingWorkspaceActions';
import { ConsoleItemSummary } from './ConsoleItemSummary';
import { ConsoleStorySummary } from './ConsoleStorySummary';

export type ConsoleListViewProps = {
  rows: ConsoleListRow[];
  storyColors: ConsoleStoryColorSource;
  statusOptions?: ConsoleFieldOption[];
  activeItemId: string | null;
  now: number;
  isLoading: boolean;
  error: string | null;
  onSelectItem: (item: ConsoleListItem) => void;
  executiveSummaries?: Record<string, string | null>;
  onOkAndAwaitingWorkspace?: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => void;
};

export const ConsoleItemList = ({
  rows,
  storyColors,
  statusOptions = [],
  activeItemId,
  now,
  isLoading,
  error,
  onSelectItem,
  executiveSummaries,
  onOkAndAwaitingWorkspace,
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
    return <p className="console-list-empty">No items</p>;
  }

  return (
    <ul className="console-list">
      {rows.map((row) => {
        if (row.kind === 'group-header') {
          return (
            <li key={`group:${row.story}`} className="console-list-group">
              <ConsoleStorySummary
                story={row.story}
                count={row.count}
                colorEnum={resolveStoryColorEnum(storyColors, row.story)}
              />
            </li>
          );
        }
        const executiveSummary =
          executiveSummaries?.[row.item.projectItemId] ?? null;
        return (
          <li key={row.item.itemId} className="console-list-row">
            <ConsoleItemSummary
              item={row.item}
              isActive={row.item.itemId === activeItemId}
              now={now}
              statusOptions={statusOptions}
              onSelect={onSelectItem}
            />
            {executiveSummary !== null && executiveSummary !== '' && (
              <span className="console-item-executive-summary">
                {executiveSummary}
              </span>
            )}
            {onOkAndAwaitingWorkspace !== undefined && (
              <ConsoleOkAndAwaitingWorkspaceActions
                statusOptions={statusOptions}
                onOkAndAwaitingWorkspace={(option) =>
                  onOkAndAwaitingWorkspace(row.item, option)
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};
