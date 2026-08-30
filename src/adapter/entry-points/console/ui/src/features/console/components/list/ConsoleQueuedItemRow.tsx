import { badgeStyle } from '../../logic/colors';
import type { ConsoleFieldOption, ConsoleListItem } from '../../logic/types';
import { ConsoleItemIcon } from '../detail/ConsoleItemIcon';

export type ConsoleQueuedItemRowProps = {
  item: ConsoleListItem;
  isActive: boolean;
  statusOptions: ConsoleFieldOption[];
  agentOptions: ConsoleFieldOption[];
  onSelect: (item: ConsoleListItem) => void;
};

const queuedBadgeStyle = (colorEnum: string | null) => ({
  ...badgeStyle(colorEnum),
  fontSize: '12px',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
});

export const ConsoleQueuedItemRow = ({
  item,
  isActive,
  statusOptions,
  agentOptions,
  onSelect,
}: ConsoleQueuedItemRowProps) => {
  const statusOption = statusOptions.find((o) => o.name === item.status);
  const agentOption = agentOptions.find((o) => o.name === item.agent);

  return (
    <button
      type="button"
      className="console-item-row console-queued-item-row"
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
      <span className="console-queued-item-title">{item.title}</span>
      <span className="console-queued-item-badges">
        {item.status !== null && item.status !== '' && (
          <span
            className="console-queued-item-badge"
            style={queuedBadgeStyle(statusOption?.color ?? null)}
          >
            {item.status}
          </span>
        )}
        {item.agent !== null && item.agent !== '' && (
          <span
            className="console-queued-item-badge"
            style={queuedBadgeStyle(agentOption?.color ?? null)}
          >
            {item.agent}
          </span>
        )}
      </span>
    </button>
  );
};
