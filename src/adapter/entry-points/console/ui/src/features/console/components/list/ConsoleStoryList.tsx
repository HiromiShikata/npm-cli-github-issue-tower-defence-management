import { useEffect, useRef, useState } from 'react';
import { CONSOLE_COLOR_PALETTE, colorFromEnum } from '../../logic/colors';
import type { ConsoleColor, ConsoleStoryEntry } from '../../logic/types';
import { ConsoleCopyStoryNameButton } from './ConsoleCopyStoryNameButton';

type RowReorderState = {
  inProgress: boolean;
  error: string | null;
};

const ALL_COLORS = Object.keys(CONSOLE_COLOR_PALETTE) as ConsoleColor[];

type InlineInputFormProps = {
  placeholder: string;
  emptyValueError: string;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
  initialValue?: string;
  submitLabel?: string;
  selectAllOnFocus?: boolean;
};

const InlineInputForm = ({
  placeholder,
  emptyValueError,
  onSubmit,
  onCancel,
  initialValue = '',
  submitLabel = 'Create',
  selectAllOnFocus = false,
}: InlineInputFormProps) => {
  const [valueInput, setValueInput] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectAllOnFocusRef = useRef(selectAllOnFocus);

  useEffect(() => {
    inputRef.current?.focus();
    if (selectAllOnFocusRef.current) {
      inputRef.current?.select();
    }
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
        {submitting ? `${submitLabel.replace(/e$/, '')}ing…` : submitLabel}
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

type StoryRenameFormProps = {
  currentName: string;
  onSubmit: (newName: string) => Promise<void>;
  onCancel: () => void;
};

const StoryRenameForm = ({
  currentName,
  onSubmit,
  onCancel,
}: StoryRenameFormProps) => (
  <InlineInputForm
    placeholder="Story name"
    emptyValueError="Story name is required"
    initialValue={currentName}
    submitLabel="Rename"
    selectAllOnFocus={true}
    onSubmit={onSubmit}
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

type StoryDeleteConfirmDialogProps = {
  storyName: string;
  isDeleting: boolean;
  deleteError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const StoryDeleteConfirmDialog = ({
  storyName,
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}: StoryDeleteConfirmDialogProps) => (
  <div
    className="console-story-delete-confirm"
    role="dialog"
    aria-modal="true"
    aria-label="Confirm story deletion"
  >
    <p className="console-story-delete-confirm-message">
      Delete story option &quot;{storyName}&quot; from the GitHub custom field?
      Tasks assigned to this story will not be deleted.
    </p>
    {deleteError !== null && (
      <p role="alert" className="console-list-error">
        {deleteError}
      </p>
    )}
    <div className="console-story-delete-confirm-actions">
      <button
        type="button"
        className="console-op-button console-op-button-danger"
        onClick={onConfirm}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : 'Delete'}
      </button>
      <button
        type="button"
        className="console-op-button"
        onClick={onCancel}
        disabled={isDeleting}
      >
        Cancel
      </button>
    </div>
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
  onReorderStory: (
    storyOptionId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onDeleteStory: (storyOptionId: string) => Promise<void>;
  onRenameStory: (storyOptionId: string, newName: string) => Promise<void>;
  optimisticColors: Record<string, ConsoleColor>;
  colorChangeInFlight: string | null;
  colorErrors: Record<string, string>;
};

type StoryDeleteState = {
  isDeleting: boolean;
  error: string | null;
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
  onReorderStory,
  onDeleteStory,
  onRenameStory,
  optimisticColors,
  colorChangeInFlight,
  colorErrors,
}: ConsoleStoryListProps) => {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [addStoryExpanded, setAddStoryExpanded] = useState(false);
  const [colorPickerOptionId, setColorPickerOptionId] = useState<string | null>(
    null,
  );
  const [rowReorderStates, setRowReorderStates] = useState<
    Record<string, RowReorderState>
  >({});
  const [deleteConfirmOptionId, setDeleteConfirmOptionId] = useState<
    string | null
  >(null);
  const [deleteStates, setDeleteStates] = useState<
    Record<string, StoryDeleteState>
  >({});
  const [renameOptionId, setRenameOptionId] = useState<string | null>(null);

  const getRowReorderState = (id: string): RowReorderState =>
    rowReorderStates[id] ?? { inProgress: false, error: null };

  const handleReorder = async (
    storyOptionId: string,
    direction: 'up' | 'down',
  ): Promise<void> => {
    setRowReorderStates((prev) => ({
      ...prev,
      [storyOptionId]: { inProgress: true, error: null },
    }));
    try {
      await onReorderStory(storyOptionId, direction);
      setRowReorderStates((prev) => ({
        ...prev,
        [storyOptionId]: { inProgress: false, error: null },
      }));
    } catch (err) {
      setRowReorderStates((prev) => ({
        ...prev,
        [storyOptionId]: {
          inProgress: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

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

  const handleDeleteClick = (storyOptionId: string): void => {
    setDeleteConfirmOptionId(storyOptionId);
  };

  const handleDeleteConfirm = async (storyOptionId: string): Promise<void> => {
    setDeleteStates((prev) => ({
      ...prev,
      [storyOptionId]: { isDeleting: true, error: null },
    }));
    try {
      await onDeleteStory(storyOptionId);
      setDeleteConfirmOptionId(null);
      setDeleteStates((prev) => ({
        ...prev,
        [storyOptionId]: { isDeleting: false, error: null },
      }));
    } catch (err) {
      setDeleteStates((prev) => ({
        ...prev,
        [storyOptionId]: {
          isDeleting: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  const handleDeleteCancel = (): void => {
    setDeleteConfirmOptionId(null);
    setDeleteStates({});
  };

  const handleRenameClick = (storyOptionId: string): void => {
    setRenameOptionId(renameOptionId === storyOptionId ? null : storyOptionId);
  };

  const handleRenameSubmit = async (
    storyOptionId: string,
    newName: string,
  ): Promise<void> => {
    await onRenameStory(storyOptionId, newName);
    setRenameOptionId(null);
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
          {visibleStories.map((entry, index) => {
            const displayColor: ConsoleColor =
              optimisticColors[entry.storyOptionId] ?? entry.color;
            const palette = colorFromEnum(displayColor);
            const isExpanded = expandedOptionId === entry.storyOptionId;
            const isPickerOpen = colorPickerOptionId === entry.storyOptionId;
            const isInFlight = colorChangeInFlight === entry.storyOptionId;
            const colorError = colorErrors[entry.storyOptionId] ?? null;
            const { inProgress: reorderInProgress, error: reorderError } =
              getRowReorderState(entry.storyOptionId);
            const isFirst = index === 0;
            const isLast = index === visibleStories.length - 1;
            const isDeleteConfirmOpen =
              deleteConfirmOptionId === entry.storyOptionId;
            const deleteState = deleteStates[entry.storyOptionId] ?? {
              isDeleting: false,
              error: null,
            };
            const isRenameOpen = renameOptionId === entry.storyOptionId;
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
                  <button
                    type="button"
                    className="console-op-button"
                    aria-label="Move up"
                    disabled={isFirst || reorderInProgress}
                    onClick={() =>
                      void handleReorder(entry.storyOptionId, 'up')
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    aria-label="Move down"
                    disabled={isLast || reorderInProgress}
                    onClick={() =>
                      void handleReorder(entry.storyOptionId, 'down')
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="console-op-button console-op-button-danger"
                    aria-label="Delete story"
                    onClick={() => handleDeleteClick(entry.storyOptionId)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    aria-label="Rename story"
                    onClick={() => handleRenameClick(entry.storyOptionId)}
                  >
                    Rename
                  </button>
                </div>
                {reorderError !== null && (
                  <p role="alert" className="console-list-error">
                    {reorderError}
                  </p>
                )}
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
                {isDeleteConfirmOpen && (
                  <StoryDeleteConfirmDialog
                    storyName={entry.storyName}
                    isDeleting={deleteState.isDeleting}
                    deleteError={deleteState.error}
                    onConfirm={() =>
                      void handleDeleteConfirm(entry.storyOptionId)
                    }
                    onCancel={handleDeleteCancel}
                  />
                )}
                {isRenameOpen && (
                  <StoryRenameForm
                    currentName={entry.storyName}
                    onSubmit={(newName) =>
                      handleRenameSubmit(entry.storyOptionId, newName)
                    }
                    onCancel={() => setRenameOptionId(null)}
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
