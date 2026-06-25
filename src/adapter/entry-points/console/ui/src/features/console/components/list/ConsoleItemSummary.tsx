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
      {(item.story !== '' ||
        (item.status !== null && item.status !== '') ||
        item.nextActionDate !== null ||
        item.nextActionHour !== null ||
        item.dependedIssueUrls.length > 0) && (
        <span className="console-item-fields">
          {item.story !== '' && (
            <span className="console-item-field">
              <span className="console-item-field-label">Story</span>
              {item.story}
            </span>
          )}
          {item.status !== null && item.status !== '' && (
            <span className="console-item-field">
              <span className="console-item-field-label">Status</span>
              {item.status}
            </span>
          )}
          {item.nextActionDate !== null && (
            <span className="console-item-field">
              <span className="console-item-field-label">Next Action Date</span>
              {item.nextActionDate.slice(0, 10)}
            </span>
          )}
          {item.nextActionHour !== null && (
            <span className="console-item-field">
              <span className="console-item-field-label">Next Action Hour</span>
              {item.nextActionHour}
            </span>
          )}
          {item.dependedIssueUrls.length > 0 && (
            <span className="console-item-field">
              <span className="console-item-field-label">
                Depended Issue URL
              </span>
              {item.dependedIssueUrls.join(', ')}
            </span>
          )}
        </span>
      )}
    </span>
  </button>
);
