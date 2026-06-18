import { colorFromEnum } from '../colors';
import type { ConsoleColor } from '../types';

export type ConsoleStoryGroupHeaderProps = {
  story: string;
  color: ConsoleColor;
  count: number;
};

export const ConsoleStoryGroupHeader = ({
  story,
  color,
  count,
}: ConsoleStoryGroupHeaderProps) => {
  const palette = colorFromEnum(color);
  return (
    <div className="flex items-center gap-2 border-b border-border pb-1 pt-4">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: palette.dot }}
      />
      <span className="text-sm font-bold">{story}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
};
