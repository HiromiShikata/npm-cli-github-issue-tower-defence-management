import type { ConsoleListItem } from '../types';
import { ConsoleItemIcon } from './ConsoleItemIcon';

export type ConsoleListItemRowProps = {
  item: ConsoleListItem;
  isActive: boolean;
  onSelect: (item: ConsoleListItem) => void;
};

export const ConsoleListItemRow = ({
  item,
  isActive,
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
    <span className="console-item-title">{item.title}</span>
    <span className="console-item-number">
      {item.isPr ? `PR #${item.number}` : `#${item.number}`}
    </span>
  </button>
);
