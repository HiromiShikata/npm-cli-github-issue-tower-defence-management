import { colorFromEnum } from '../../logic/colors';
import type { ConsoleColor } from '../../logic/types';

export type ConsoleStoryGroupHeaderProps = {
  story: string;
  count: number;
  colorEnum: ConsoleColor | null;
};

export const ConsoleStorySummary = ({
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
