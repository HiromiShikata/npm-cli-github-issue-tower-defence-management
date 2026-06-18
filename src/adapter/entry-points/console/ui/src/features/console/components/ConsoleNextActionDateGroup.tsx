import { Button } from '@/components/ui/button';
import type { ConsoleSnoozeEvent, ConsoleTabName } from '../types';

export type ConsoleNextActionDateGroupProps = {
  tab: ConsoleTabName;
  onSnooze: (event: ConsoleSnoozeEvent) => void;
};

export const ConsoleNextActionDateGroup = ({
  tab,
  onSnooze,
}: ConsoleNextActionDateGroupProps) => {
  const isTodoByHuman = tab === 'todo-by-human';
  const weekLabel = isTodoByHuman ? '+1 week and skip' : '+1 week';
  const dayTitle = isTodoByHuman
    ? 'Set Next Action Date to today + 1 day and move on to the next task'
    : 'Set Next Action Date to today + 1 day (stays on this item)';
  const weekTitle = isTodoByHuman
    ? 'Set Next Action Date to today + 7 days and move on to the next task'
    : 'Set Next Action Date to today + 7 days (stays on this item)';

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        title={dayTitle}
        onClick={() => onSnooze('snooze_1day')}
      >
        +1 day
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        title={weekTitle}
        onClick={() => onSnooze('snooze_1week')}
      >
        {weekLabel}
      </Button>
    </div>
  );
};
