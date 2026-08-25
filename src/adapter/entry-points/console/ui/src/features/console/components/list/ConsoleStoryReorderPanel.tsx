import { useState } from 'react';
import type { ConsoleFieldOption } from '../../logic/types';

export type ConsoleStoryReorderPanelProps = {
  stories: ConsoleFieldOption[];
  onReorderStory: (
    storyOptionId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
};

type RowState = {
  inProgress: boolean;
  error: string | null;
};

export const ConsoleStoryReorderPanel = ({
  stories,
  onReorderStory,
}: ConsoleStoryReorderPanelProps) => {
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const getRowState = (id: string): RowState =>
    rowStates[id] ?? { inProgress: false, error: null };

  const handleReorder = async (
    storyOptionId: string,
    direction: 'up' | 'down',
  ): Promise<void> => {
    setRowStates((prev) => ({
      ...prev,
      [storyOptionId]: { inProgress: true, error: null },
    }));
    try {
      await onReorderStory(storyOptionId, direction);
      setRowStates((prev) => ({
        ...prev,
        [storyOptionId]: { inProgress: false, error: null },
      }));
    } catch (err) {
      setRowStates((prev) => ({
        ...prev,
        [storyOptionId]: {
          inProgress: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  return (
    <ul className="console-story-reorder-panel">
      {stories.map((story, index) => {
        const { inProgress, error } = getRowState(story.id);
        const isFirst = index === 0;
        const isLast = index === stories.length - 1;
        return (
          <li key={story.id} className="console-story-reorder-row">
            <button
              type="button"
              className="console-op-button"
              aria-label="Move up"
              disabled={isFirst || inProgress}
              onClick={() => void handleReorder(story.id, 'up')}
            >
              ↑
            </button>
            <button
              type="button"
              className="console-op-button"
              aria-label="Move down"
              disabled={isLast || inProgress}
              onClick={() => void handleReorder(story.id, 'down')}
            >
              ↓
            </button>
            <span className="console-story-reorder-name">{story.name}</span>
            {inProgress && (
              <span className="console-story-reorder-progress">…</span>
            )}
            {error !== null && (
              <span role="alert" className="console-story-reorder-error">
                {error}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
