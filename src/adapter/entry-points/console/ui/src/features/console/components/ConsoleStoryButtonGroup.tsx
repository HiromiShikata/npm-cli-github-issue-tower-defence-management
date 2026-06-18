import type { CSSProperties } from 'react';
import { colorFromEnum } from '../colors';
import type { ConsoleFieldOption } from '../types';

const storyButtonStyle = (option: ConsoleFieldOption): CSSProperties => {
  const palette = colorFromEnum(option.color);
  return {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    color: palette.fg,
  };
};

const isNoStoryOption = (option: ConsoleFieldOption): boolean =>
  option.name.toLowerCase().includes('no story');

export type ConsoleStoryButtonGroupProps = {
  storyOptions: ConsoleFieldOption[];
  onSetStory: (option: ConsoleFieldOption) => void;
};

export const ConsoleStoryButtonGroup = ({
  storyOptions,
  onSetStory,
}: ConsoleStoryButtonGroupProps) => {
  const assignableOptions = storyOptions.filter(
    (option) => !isNoStoryOption(option),
  );

  if (assignableOptions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {assignableOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          style={storyButtonStyle(option)}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
          onClick={() => onSetStory(option)}
        >
          {option.name}
        </button>
      ))}
    </div>
  );
};
