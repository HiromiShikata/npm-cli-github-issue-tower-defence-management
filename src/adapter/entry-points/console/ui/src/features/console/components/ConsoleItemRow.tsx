import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConsoleListItem } from '../types';
import { ConsoleItemIcon } from './ConsoleItemIcon';

export type ConsoleItemRowProps = {
  item: ConsoleListItem;
  isSelected: boolean;
  onSelect: (item: ConsoleListItem) => void;
};

export const ConsoleItemRow = ({
  item,
  isSelected,
  onSelect,
}: ConsoleItemRowProps) => (
  <button
    type="button"
    aria-pressed={isSelected}
    className={cn(
      'flex w-full flex-col gap-1 px-3 py-3 text-left hover:bg-accent',
      isSelected && 'bg-accent',
    )}
    onClick={() => onSelect(item)}
  >
    <div className="flex items-center gap-2">
      <ConsoleItemIcon
        isPr={item.isPr}
        state={item.state}
        stateReason={item.stateReason}
      />
      <span className="font-medium">{item.title}</span>
      <span className="text-sm text-muted-foreground">#{item.number}</span>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">{item.repo}</Badge>
      <Badge variant={item.isPr ? 'default' : 'outline'}>
        {item.isPr ? 'PR' : 'Issue'}
      </Badge>
      <span>{new Date(item.createdAt).toISOString()}</span>
    </div>
  </button>
);
