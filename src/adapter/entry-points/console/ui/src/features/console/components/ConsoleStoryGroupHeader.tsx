import { colorFromEnum } from '../colors';
import type { ConsoleColor } from '../types';

export type ConsoleStoryGroupHeaderProps = {
  story: string;
  count: number;
  colorEnum: ConsoleColor | null;
};

export const ConsoleStoryGroupHeader = ({
  story,
  count,
  colorEnum,
}: ConsoleStoryGroupHeaderProps) => {
  const palette = colorFromEnum(colorEnum);
  return (
    <div className="console-group-header">
      <span className="console-storytag">
        <span
          className="console-story-dot"
          style={{ backgroundColor: palette.dot }}
        />
        {story}
      </span>
      <span className="console-group-count">{count}</span>
    </div>
  );
};
