import { useEffect, useRef, useState } from 'react';
import { CONSOLE_COLOR_PALETTE, colorFromEnum } from '../../logic/colors';
import type { ConsoleColor, ConsoleStoryEntry } from '../../logic/types';
import { ConsoleCopyStoryNameButton } from './ConsoleCopyStoryNameButton';

const ALL_COLORS = Object.keys(CONSOLE_COLOR_PALETTE) as ConsoleColor[];

type InlineInputFormProps = {
  placeholder: string;
  emptyValueError: string;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
};

const InlineInputForm = ({
  placeholder,
  emptyValueError,
  onSubmit,
  onCancel,
}: InlineInputFormProps) => {
  const [valueInput, setValueInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const trimmed = valueInput.trim();
    if (trimmed.length === 0) {
      setSubmitError(emptyValueError);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="console-inline-input-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        className="console-inline-input-form-input"
        placeholder={placeholder}
        value={valueInput}
        onChange={(e) => setValueInput(e.target.value)}
        disabled={submitting}
      />
      <button type="submit" className="console-op-button" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create'}
      </button>
      <button
        type="button"
        className="console-op-button"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancel
      </button>
      {submitError !== null && (
        <p role="alert" className="console-list-error">
          {submitError}
        </p>
      )}
    </form>
  );
};

type StoryCreateFormProps = {
  storyOptionId: string;
  onSubmit: (storyOptionId: string, title: string) => Promise<void>;
  onCancel: () => void;
};

const StoryCreateForm = ({
  storyOptionId,
  onSubmit,
  onCancel,
}: StoryCreateFormProps) => (
  <InlineInputForm
    placeholder="Issue title"
    emptyValueError="Title is required"
    onSubmit={(title) => onSubmit(storyOptionId, title)}
    onCancel={onCancel}
  />
);

type ColorPaletteProps = {
  onSelectColor: (color: ConsoleColor) => void;
  disabled: boolean;
};

const ColorPalette = ({ onSelectColor, disabled }: ColorPaletteProps) => (
  <div className="console-story-color-palette">
    {ALL_COLORS.map((color) => {
      const palette = CONSOLE_COLOR_PALETTE[color];
      return (
        <button
          key={color}
          type="button"
          className="console-story-color-swatch"
          aria-label={color === 'GRAY' ? `${color} (disable)` : color}
          style={{ backgroundColor: palette.dot }}
          onClick={() => onSelectColor(color)}
          disabled={disabled}
        >
          {color === 'GRAY' && (
            <span className="console-story-color-swatch-label">disable</span>
          )}
        </button>
      );
    })}
  </div>
);

export type ConsoleStoryListProps = {
  stories: ConsoleStoryEntry[];
  isLoading: boolean;
  error: string | null;
  showGray: boolean;
  onCreateIssue: (storyOptionId: string, title: string) => Promise<void>;
  onAddStory: (storyName: string) => Promise<void>;
  onSelectColor: (storyOptionId: string, newColor: ConsoleColor) => void;
  onToggleGray: () => void;
  optimisticColors: Record<string, ConsoleColor>;
  colorChangeInFlight: string | null;
  colorErrors: Record<string, string>;
};

export const ConsoleStoryList = ({
  stories,
  isLoading,
  error,
  showGray,
  onCreateIssue,
  onAddStory,
  onSelectColor,
  onToggleGray,
  optimisticColors,
  colorChangeInFlight,
  colorErrors,
}: ConsoleStoryListProps) => {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [addStoryExpanded, setAddStoryExpanded] = useState(false);
  const [colorPickerOptionId, setColorPickerOptionId] = useState<string | null>(
    null,
  );

  if (error !== null) {
    return (
      <p role="alert" className="console-list-message console-list-error">
        Failed to load stories: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-list-message">Loading stories...</p>;
  }

  const handleAddClick = (storyOptionId: string): void => {
    setExpandedOptionId(
      expandedOptionId === storyOptionId ? null : storyOptionId,
    );
  };

  const handleSubmit = async (
    storyOptionId: string,
    title: string,
  ): Promise<void> => {
    await onCreateIssue(storyOptionId, title);
    setExpandedOptionId(null);
  };

  const handleColorButtonClick = (storyOptionId: string): void => {
    setColorPickerOptionId(
      colorPickerOptionId === storyOptionId ? null : storyOptionId,
    );
  };

  const handleSwatchClick = (
    storyOptionId: string,
    newColor: ConsoleColor,
  ): void => {
    setColorPickerOptionId(null);
    onSelectColor(storyOptionId, newColor);
  };

  const visibleStories = showGray
    ? stories
    : stories.filter((s) => s.color !== 'GRAY');
  const hasGrayStories = stories.some((s) => s.color === 'GRAY');

  return (
    <div className="console-story-list-container">
      {visibleStories.length === 0 ? (
        <p className="console-list-empty">No active stories</p>
      ) : (
        <ul className="console-story-list">
          {visibleStories.map((entry) => {
            const displayColor: ConsoleColor =
              optimisticColors[entry.storyOptionId] ?? entry.color;
            const palette = colorFromEnum(displayColor);
            const isExpanded = expandedOptionId === entry.storyOptionId;
            const isPickerOpen = colorPickerOptionId === entry.storyOptionId;
            const isInFlight = colorChangeInFlight === entry.storyOptionId;
            const colorError = colorErrors[entry.storyOptionId] ?? null;
            return (
              <li key={entry.storyOptionId} className="console-story-list-row">
                <div className="console-story-list-row-main">
                  {entry.storyViewUrl ? (
                    <a
                      href={entry.storyViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="console-storytag"
                      style={{ color: palette.fg, borderColor: palette.border }}
                    >
                      <span
                        className="console-story-dot"
                        style={{ backgroundColor: palette.dot }}
                      />
                      {entry.storyName}
                    </a>
                  ) : (
                    <span
                      className="console-storytag"
                      style={{ color: palette.fg, borderColor: palette.border }}
                    >
                      <span
                        className="console-story-dot"
                        style={{ backgroundColor: palette.dot }}
                      />
                      {entry.storyName}
                    </span>
                  )}
                  <ConsoleCopyStoryNameButton storyName={entry.storyName} />
                  <span className="console-story-count">
                    {entry.openItemCount}
                  </span>
                  <button
                    type="button"
                    className="console-op-button"
                    onClick={() => handleAddClick(entry.storyOptionId)}
                  >
                    Add task
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    onClick={() => handleColorButtonClick(entry.storyOptionId)}
                    disabled={isInFlight}
                  >
                    Change color
                  </button>
                </div>
                {isPickerOpen && (
                  <ColorPalette
                    onSelectColor={(newColor) =>
                      handleSwatchClick(entry.storyOptionId, newColor)
                    }
                    disabled={isInFlight}
                  />
                )}
                {colorError !== null && (
                  <p role="alert" className="console-list-error">
                    {colorError}
                  </p>
                )}
                {isExpanded && (
                  <StoryCreateForm
                    storyOptionId={entry.storyOptionId}
                    onSubmit={handleSubmit}
                    onCancel={() => setExpandedOptionId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasGrayStories && (
        <button
          type="button"
          className="console-op-button"
          onClick={onToggleGray}
        >
          {showGray ? 'Hide archived' : 'Show archived'}
        </button>
      )}
      <div className="console-add-story-section">
        <button
          type="button"
          className="console-op-button"
          onClick={() => setAddStoryExpanded(!addStoryExpanded)}
        >
          Add story
        </button>
        {addStoryExpanded && (
          <InlineInputForm
            placeholder="Story name"
            emptyValueError="Story name is required"
            onSubmit={async (storyName) => {
              await onAddStory(storyName);
              setAddStoryExpanded(false);
            }}
            onCancel={() => setAddStoryExpanded(false)}
          />
        )}
      </div>
    </div>
  );
};
