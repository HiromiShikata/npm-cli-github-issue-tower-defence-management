import {
  formatFullTimestamp,
  formatRelativeTime,
} from '../../logic/relativeTime';
import type { ConsoleListItem } from '../../logic/types';
import { ConsoleItemIcon } from '../detail/ConsoleItemIcon';

export type ConsoleListItemRowProps = {
  item: ConsoleListItem;
  isActive: boolean;
  now: number;
  onSelect: (item: ConsoleListItem) => void;
};

export const ConsoleItemSummary = ({
  item,
  isActive,
  now,
  onSelect,
}: ConsoleListItemRowProps) => (
  <button
    type="button"
    className="console-item-row"
    aria-current={isActive ? 'true' : undefined}
    data-active={isActive ? 'true' : undefined}
    onClick={() => onSelect(item)}
  >
    <ConsoleItemIcon
      isPr={item.isPr}
      state="open"
      merged={false}
      isDraft={false}
      stateReason=""
    />
    <span className="console-item-meta">
      <span className="console-item-title">{item.title}</span>
      <span className="console-item-sub">
        <span className="console-item-pill">#{item.number}</span>
        {item.repo !== '' && (
          <span className="console-item-pill">{item.repo}</span>
        )}
        <span className="console-item-pill">{item.isPr ? 'PR' : 'Issue'}</span>
        {item.createdAt !== '' && (
          <span className="console-item-opened">
            {' · opened '}
            <span
              className="console-item-createdat"
              title={formatFullTimestamp(item.createdAt)}
            >
              {formatRelativeTime(item.createdAt, now)}
            </span>
          </span>
        )}
      </span>
    </span>
  </button>
);
