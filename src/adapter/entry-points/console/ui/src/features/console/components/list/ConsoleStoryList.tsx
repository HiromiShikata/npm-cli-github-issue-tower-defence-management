import { useState } from 'react';
import { colorFromEnum } from '../../logic/colors';
import type {
  ConsoleColor,
  ConsoleListItem,
  ConsoleStoryEntry,
} from '../../logic/types';
import { ConsoleStoryColorSelectModalDialog } from './ConsoleStoryColorSelectModalDialog';
import { ConsoleStoryCreateModalDialog } from './ConsoleStoryCreateModalDialog';
import { ConsoleStoryDeleteModalDialog } from './ConsoleStoryDeleteModalDialog';
import { ConsoleStoryDescriptionModalDialog } from './ConsoleStoryDescriptionModalDialog';
import { ConsoleStoryRenameModalDialog } from './ConsoleStoryRenameModalDialog';
import { ConsoleStoryTaskCreateModalDialog } from './ConsoleStoryTaskCreateModalDialog';

type RowReorderState = {
  inProgress: boolean;
  error: string | null;
};

type StoryTaskListProps = {
  items: ConsoleListItem[];
};

const StoryTaskList = ({ items }: StoryTaskListProps) => (
  <ul className="console-story-task-list">
    {items.map((item) => (
      <li key={item.url} className="console-story-task-row">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="console-story-task-title"
        >
          {item.title}
        </a>
        <span className="console-story-task-status">{item.status ?? '—'}</span>
        <span className="console-story-task-agent">{item.agent ?? '—'}</span>
        <span className="console-story-task-depended-urls">
          {item.dependedIssueUrls.length > 0
            ? item.dependedIssueUrls.join(', ')
            : '—'}
        </span>
        <span className="console-story-task-next-action-date">
          {item.nextActionDate !== null
            ? item.nextActionDate.slice(0, 10)
            : '—'}
        </span>
        <span className="console-story-task-next-action-hour">
          {item.nextActionHour !== null ? String(item.nextActionHour) : '—'}
        </span>
      </li>
    ))}
  </ul>
);

export type ConsoleStoryListProps = {
  stories: ConsoleStoryEntry[];
  isLoading: boolean;
  error: string | null;
  showGray: boolean;
  onCreateIssue: (storyName: string, title: string) => Promise<void>;
  onAddStory: (storyName: string) => Promise<void>;
  onSelectColor: (storyOptionId: string, newColor: ConsoleColor) => void;
  onToggleGray: () => void;
  onReorderStory: (
    storyOptionId: string,
    direction: 'up' | 'down',
  ) => Promise<void>;
  onDeleteStory: (
    storyOptionId: string,
    deleteChildTasks: boolean,
  ) => Promise<void>;
  onRenameStory: (storyOptionId: string, newName: string) => Promise<void>;
  onUpdateDescription: (
    storyOptionId: string,
    newDescription: string,
  ) => Promise<void>;
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
  onUpdateDescription,
  optimisticColors,
  colorChangeInFlight,
  colorErrors,
}: ConsoleStoryListProps) => {
  const [taskCreateDialogId, setTaskCreateDialogId] = useState<string | null>(
    null,
  );
  const [storyCreateDialogOpen, setStoryCreateDialogOpen] = useState(false);
  const [colorPickerOptionId, setColorPickerOptionId] = useState<string | null>(
    null,
  );
  const [expandedTasksOptionId, setExpandedTasksOptionId] = useState<
    string | null
  >(null);
  const [deleteConfirmOptionId, setDeleteConfirmOptionId] = useState<
    string | null
  >(null);
  const [deleteStates, setDeleteStates] = useState<
    Record<string, StoryDeleteState>
  >({});
  const [renameOptionId, setRenameOptionId] = useState<string | null>(null);
  const [descriptionEditOptionId, setDescriptionEditOptionId] = useState<
    string | null
  >(null);
  const [rowReorderStates, setRowReorderStates] = useState<
    Record<string, RowReorderState>
  >({});

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

  const handleDeleteConfirm = async (
    storyOptionId: string,
    deleteChildTasks: boolean,
  ): Promise<void> => {
    setDeleteStates((prev) => ({
      ...prev,
      [storyOptionId]: { isDeleting: true, error: null },
    }));
    try {
      await onDeleteStory(storyOptionId, deleteChildTasks);
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

  const visibleStories = showGray
    ? stories
    : stories.filter((s) => s.color !== 'GRAY');
  const hasGrayStories = stories.some((s) => s.color === 'GRAY');

  const taskCreateEntry =
    taskCreateDialogId !== null
      ? stories.find((s) => s.storyOptionId === taskCreateDialogId) ?? null
      : null;
  const colorPickerEntry =
    colorPickerOptionId !== null
      ? stories.find((s) => s.storyOptionId === colorPickerOptionId) ?? null
      : null;
  const deleteEntry =
    deleteConfirmOptionId !== null
      ? stories.find((s) => s.storyOptionId === deleteConfirmOptionId) ?? null
      : null;
  const activeDeleteState =
    deleteConfirmOptionId !== null
      ? (deleteStates[deleteConfirmOptionId] ?? { isDeleting: false, error: null })
      : { isDeleting: false, error: null };
  const renameEntry =
    renameOptionId !== null
      ? stories.find((s) => s.storyOptionId === renameOptionId) ?? null
      : null;
  const descriptionEntry =
    descriptionEditOptionId !== null
      ? stories.find((s) => s.storyOptionId === descriptionEditOptionId) ?? null
      : null;

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
            const isInFlight = colorChangeInFlight === entry.storyOptionId;
            const colorError = colorErrors[entry.storyOptionId] ?? null;
            const { inProgress: reorderInProgress, error: reorderError } =
              getRowReorderState(entry.storyOptionId);
            const isFirst = index === 0;
            const isLast = index === visibleStories.length - 1;
            const isTasksExpanded =
              expandedTasksOptionId === entry.storyOptionId;
            const description = entry.description ?? '';
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
                  <span className="console-story-count">
                    {entry.openItemCount}
                  </span>
                  <button
                    type="button"
                    className="console-op-button"
                    onClick={() =>
                      setTaskCreateDialogId(
                        taskCreateDialogId === entry.storyOptionId
                          ? null
                          : entry.storyOptionId,
                      )
                    }
                  >
                    Add task
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    onClick={() =>
                      setColorPickerOptionId(
                        colorPickerOptionId === entry.storyOptionId
                          ? null
                          : entry.storyOptionId,
                      )
                    }
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
                    onClick={() =>
                      setDeleteConfirmOptionId(entry.storyOptionId)
                    }
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    aria-label="Rename story"
                    onClick={() =>
                      setRenameOptionId(
                        renameOptionId === entry.storyOptionId
                          ? null
                          : entry.storyOptionId,
                      )
                    }
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    aria-label="Edit description"
                    onClick={() =>
                      setDescriptionEditOptionId(
                        descriptionEditOptionId === entry.storyOptionId
                          ? null
                          : entry.storyOptionId,
                      )
                    }
                  >
                    Edit description
                  </button>
                  <button
                    type="button"
                    className="console-op-button"
                    onClick={() =>
                      setExpandedTasksOptionId(
                        isTasksExpanded ? null : entry.storyOptionId,
                      )
                    }
                  >
                    {isTasksExpanded ? 'Hide tasks' : 'Show tasks'}
                  </button>
                </div>
                {description !== '' && (
                  <p className="console-story-description">{description}</p>
                )}
                {isTasksExpanded && <StoryTaskList items={entry.items} />}
                {reorderError !== null && (
                  <p role="alert" className="console-list-error">
                    {reorderError}
                  </p>
                )}
                {colorError !== null && (
                  <p role="alert" className="console-list-error">
                    {colorError}
                  </p>
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
          onClick={() => setStoryCreateDialogOpen(!storyCreateDialogOpen)}
        >
          Add story
        </button>
      </div>
      {taskCreateEntry !== null && (
        <ConsoleStoryTaskCreateModalDialog
          storyName={taskCreateEntry.storyName}
          onSubmit={(storyName, title) => onCreateIssue(storyName, title)}
          onClose={() => setTaskCreateDialogId(null)}
        />
      )}
      {storyCreateDialogOpen && (
        <ConsoleStoryCreateModalDialog
          onSubmit={(storyName) => onAddStory(storyName)}
          onClose={() => setStoryCreateDialogOpen(false)}
        />
      )}
      {colorPickerEntry !== null && (
        <ConsoleStoryColorSelectModalDialog
          storyName={colorPickerEntry.storyName}
          storyOptionId={colorPickerEntry.storyOptionId}
          onSelectColor={(storyOptionId, color) => {
            setColorPickerOptionId(null);
            onSelectColor(storyOptionId, color);
          }}
          onClose={() => setColorPickerOptionId(null)}
          disabled={colorChangeInFlight === colorPickerEntry.storyOptionId}
        />
      )}
      {deleteEntry !== null && (
        <ConsoleStoryDeleteModalDialog
          storyName={deleteEntry.storyName}
          isDeleting={activeDeleteState.isDeleting}
          deleteError={activeDeleteState.error}
          onConfirm={(deleteChildTasks) =>
            void handleDeleteConfirm(
              deleteEntry.storyOptionId,
              deleteChildTasks,
            )
          }
          onCancel={() => {
            setDeleteConfirmOptionId(null);
            setDeleteStates({});
          }}
        />
      )}
      {renameEntry !== null && (
        <ConsoleStoryRenameModalDialog
          currentName={renameEntry.storyName}
          onSubmit={(newName) =>
            onRenameStory(renameEntry.storyOptionId, newName)
          }
          onClose={() => setRenameOptionId(null)}
        />
      )}
      {descriptionEntry !== null && (
        <ConsoleStoryDescriptionModalDialog
          currentDescription={descriptionEntry.description ?? ''}
          onSubmit={(newDescription) =>
            onUpdateDescription(descriptionEntry.storyOptionId, newDescription)
          }
          onClose={() => setDescriptionEditOptionId(null)}
        />
      )}
    </div>
  );
};
