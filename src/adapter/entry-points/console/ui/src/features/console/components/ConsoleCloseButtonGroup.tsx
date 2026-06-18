import { Button } from '@/components/ui/button';
import type { ConsoleCloseEvent } from '../types';

export type ConsoleCloseButtonGroupProps = {
  onClose: (event: ConsoleCloseEvent) => void;
};

export const ConsoleCloseButtonGroup = ({
  onClose,
}: ConsoleCloseButtonGroupProps) => (
  <div className="flex flex-wrap gap-2">
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onClose('close')}
    >
      Close
    </Button>
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onClose('close_not_planned')}
    >
      Close as not planned
    </Button>
  </div>
);
