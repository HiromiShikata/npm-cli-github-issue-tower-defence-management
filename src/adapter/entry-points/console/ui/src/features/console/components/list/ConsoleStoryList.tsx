import { useEffect, useState } from 'react';
import { colorFromEnum } from '../../logic/colors';
import type {
  ConsoleColor,
  ConsoleListItem,
  ConsoleStoryEntry,
} from '../../logic/types';
import { ConsoleToggleSwitch } from '../shared/ConsoleToggleSwitch';
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

const OWNER_ACTIONABLE_STATUS_NAMES = new Set<string>([
  'Todo by human',
  'Awaiting Owner',
  'Failed Preparation',
  'In Tmux by human',
]);

type StoryTaskListProps = {
  items: ConsoleListItem[];
  onOpenItem: (item: ConsoleListItem) => void;
};

type StoryVisibilityToggleProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};

const StoryVisibilityToggle = ({
  label,
  checked,
  onChange,
}: StoryVisibilityToggleProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: '0.875rem', color: '#c9d1d9' }}>{label}</span>
    <ConsoleToggleSwitch
      checked={checked}
      ariaLabel={label}
      onChange={() => onChange()}
    />
  </div>
);

const StoryTaskList = ({ items, onOpenItem }: StoryTaskListProps) => (
  <ul className="console-story-task-list">
    {items.map((item) => (
      <li key={item.url} className="console-story-task-row">
        <button
          type="button"
          className="console-story-task-title"
          onClick={() => onOpenItem(item)}
        >
          {item.title}
        </button>
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
  showArchived: boolean;
  showDone: boolean;
  onCreateIssue: (storyName: string, title: string) => Promise<void>;
  onAddStory: (storyName: string) => Promise<void>;
  onSelectColor: (storyOptionId: string, newColor: ConsoleColor) => void;
  onToggleArchived: () => void;
  onToggleDone: () => void;
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
  onStoryTaskCreateEdit?: (storyName: string, title: string) => void;
  optimisticColors: Record<string, ConsoleColor>;
  colorChangeInFlight: string | null;
  colorErrors: Record<string, string>;
  onOpenItem: (item: ConsoleListItem) => void;
};

type StoryDeleteState = {
  isDeleting: boolean;
  error: string | null;
};

export const ConsoleStoryList = ({
  stories,
  isLoading,
  error,
  showArchived,
  showDone,
  onCreateIssue,
  onAddStory,
  onSelectColor,
  onToggleArchived,
  onToggleDone,
  onReorderStory,
  onDeleteStory,
  onRenameStory,
  onUpdateDescription,
  onStoryTaskCreateEdit,
  optimisticColors,
  colorChangeInFlight,
  colorErrors,
  onOpenItem,
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
  const [overflowMenuOpenId, setOverflowMenuOpenId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (overflowMenuOpenId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        !target.closest('.console-story-overflow-menu') &&
        !target.closest('.console-story-overflow-btn')
      ) {
        setOverflowMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [overflowMenuOpenId]);

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

  const visibleStories = stories.filter((entry) => {
    if (!showArchived && entry.color === 'GRAY') {
      return false;
    }
    const items = entry.items ?? [];
    if (
      !showDone &&
      items.length > 0 &&
      items.every(
        (item) =>
          item.status !== null && !OWNER_ACTIONABLE_STATUS_NAMES.has(item.status),
      )
    ) {
      return false;
    }
    return true;
  });

  const taskCreateEntry =
    taskCreateDialogId !== null
      ? (stories.find((s) => s.storyOptionId === taskCreateDialogId) ?? null)
      : null;
  const colorPickerEntry =
    colorPickerOptionId !== null
      ? (stories.find((s) => s.storyOptionId === colorPickerOptionId) ?? null)
      : null;
  const deleteEntry =
    deleteConfirmOptionId !== null
      ? (stories.find((s) => s.storyOptionId === deleteConfirmOptionId) ?? null)
      : null;
  const activeDeleteState =
    deleteConfirmOptionId !== null
      ? (deleteStates[deleteConfirmOptionId] ?? {
          isDeleting: false,
          error: null,
        })
      : { isDeleting: false, error: null };
  const renameEntry =
    renameOptionId !== null
      ? (stories.find((s) => s.storyOptionId === renameOptionId) ?? null)
      : null;
  const descriptionEntry =
    descriptionEditOptionId !== null
      ? (stories.find((s) => s.storyOptionId === descriptionEditOptionId) ??
        null)
      : null;

  return (
    <div className="console-story-list-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <StoryVisibilityToggle
          label="Archived"
          checked={showArchived}
          onChange={onToggleArchived}
        />
        <StoryVisibilityToggle
          label="Done"
          checked={showDone}
          onChange={onToggleDone}
        />
      </div>
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
            const isOverflowOpen = overflowMenuOpenId === entry.storyOptionId;
            const description = entry.description ?? '';
            return (
              <li key={entry.storyOptionId} className="console-story-list-row">
                <div className="console-story-list-row-main">
                  <button
                    type="button"
                    className="console-story-name-toggle"
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      setExpandedTasksOptionId(
                        isTasksExpanded ? null : entry.storyOptionId,
                      )
                    }
                  >
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
                  </button>
                  <span className="console-story-count">
                    {entry.openItemCount}
                  </span>
                  <button
                    type="button"
                    className="console-story-chevron"
                    aria-label={isTasksExpanded ? 'Hide tasks' : 'Show tasks'}
                    onClick={() =>
                      setExpandedTasksOptionId(
                        isTasksExpanded ? null : entry.storyOptionId,
                      )
                    }
                  >
                    {isTasksExpanded ? '▼' : '▶'}
                  </button>
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
                    + Add task
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
                  <div className="console-story-overflow-container">
                    <button
                      type="button"
                      className="console-story-overflow-btn"
                      aria-label="More options"
                      aria-haspopup="menu"
                      aria-expanded={isOverflowOpen}
                      onClick={() =>
                        setOverflowMenuOpenId(
                          isOverflowOpen ? null : entry.storyOptionId,
                        )
                      }
                    >
                      ⋯
                    </button>
                    {isOverflowOpen && (
                      <div role="menu" className="console-story-overflow-menu">
                        <button
                          type="button"
                          role="menuitem"
                          className="console-story-overflow-option"
                          disabled={isInFlight}
                          onClick={() => {
                            setOverflowMenuOpenId(null);
                            setColorPickerOptionId(entry.storyOptionId);
                          }}
                        >
                          Change color
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="console-story-overflow-option"
                          onClick={() => {
                            setOverflowMenuOpenId(null);
                            setRenameOptionId(entry.storyOptionId);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="console-story-overflow-option"
                          onClick={() => {
                            setOverflowMenuOpenId(null);
                            setDescriptionEditOptionId(entry.storyOptionId);
                          }}
                        >
                          Edit description
                        </button>
                        <hr className="console-story-overflow-separator" />
                        <button
                          type="button"
                          role="menuitem"
                          className="console-story-overflow-option console-story-overflow-option--danger"
                          onClick={() => {
                            setOverflowMenuOpenId(null);
                            setDeleteConfirmOptionId(entry.storyOptionId);
                          }}
                        >
                          Delete story
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {description !== '' && (
                  <p className="console-story-description">{description}</p>
                )}
                {isTasksExpanded && (
                  <StoryTaskList items={entry.items} onOpenItem={onOpenItem} />
                )}
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
          onEdit={
            onStoryTaskCreateEdit !== undefined
              ? (storyName, title) => {
                  setTaskCreateDialogId(null);
                  onStoryTaskCreateEdit(storyName, title);
                }
              : undefined
          }
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
