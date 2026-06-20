import { colorFromEnum } from '../../logic/colors';
import type { ConsoleFieldOption } from '../../logic/types';

export type ConsoleStoryButtonGroupProps = {
  storyOptions: ConsoleFieldOption[];
  onSetStory: (option: ConsoleFieldOption) => void;
};

const isNoStoryOption = (option: ConsoleFieldOption): boolean =>
  option.name.toLowerCase().includes('no story');

export const ConsoleStoryActions = ({
  storyOptions,
  onSetStory,
}: ConsoleStoryButtonGroupProps) => {
  const assignable = storyOptions.filter((option) => !isNoStoryOption(option));
  if (assignable.length === 0) {
    return null;
  }
  return (
    <div className="console-op-group console-op-group-stories">
      {assignable.map((option) => {
        const palette = colorFromEnum(option.color);
        return (
          <button
            key={option.id}
            type="button"
            className="console-op-button"
            style={{
              color: palette.fg,
              borderColor: palette.border,
              backgroundColor: palette.bg,
            }}
            onClick={() => onSetStory(option)}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
};
