import type { ConsoleFieldOption } from '../../logic/types';
import { ConsoleFieldOptionSelect } from './ConsoleFieldOptionSelect';

export type ConsoleStorySelectActionsProps = {
  storyOptions: ConsoleFieldOption[];
  currentStoryName: string | null;
  onSetStory: (option: ConsoleFieldOption) => void;
};

export const ConsoleStorySelectActions = ({
  storyOptions,
  currentStoryName,
  onSetStory,
}: ConsoleStorySelectActionsProps) => {
  if (storyOptions.length === 0) return null;

  const currentOption =
    currentStoryName !== null
      ? (storyOptions.find((o) => o.name === currentStoryName) ?? null)
      : null;

  return (
    <div className="console-op-group">
      <ConsoleFieldOptionSelect
        key={currentOption?.id ?? 'none'}
        className="console-story-select"
        ariaLabel="Set story"
        placeholder="— story —"
        currentOption={currentOption}
        options={storyOptions}
        onSelect={onSetStory}
      />
    </div>
  );
};
