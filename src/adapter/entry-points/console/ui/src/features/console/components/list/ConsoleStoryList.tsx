import { useEffect, useState } from 'react';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleStoryRowField } from '../../logic/consoleStoryRowFields';
import {
  filterConsoleStoryEntriesByStatusSelection,
  resolveEffectiveConsoleStoryStatusSelection,
} from '../../logic/consoleStoryStatusSelection';
import { parseDependedIssueUrlsInput } from '../../logic/consoleStoryTaskPatch';
import type {
  ConsoleColor,
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryEntry,
} from '../../logic/types';
import { ConsoleAgentSelectActions } from '../operations/ConsoleAgentSelectActions';
import { ConsoleFieldOptionSelect } from '../operations/ConsoleFieldOptionSelect';
import { ConsoleStorySelectActions } from '../operations/ConsoleStorySelectActions';
import { ConsoleToggleSwitch } from '../shared/ConsoleToggleSwitch';
import { ConsoleStoryColorSelectModalDialog } from './ConsoleStoryColorSelectModalDialog';
import { ConsoleStoryCreateModalDialog } from './ConsoleStoryCreateModalDialog';
import { ConsoleStoryDeleteModalDialog } from './ConsoleStoryDeleteModalDialog';
import { ConsoleStoryDescriptionModalDialog } from './ConsoleStoryDescriptionModalDialog';
import { ConsoleStoryRenameModalDialog } from './ConsoleStoryRenameModalDialog';
import { ConsoleStoryRowFieldToggles } from './ConsoleStoryRowFieldToggles';
import { ConsoleStoryStatusFilter } from './ConsoleStoryStatusFilter';
import { ConsoleStoryTaskCreateModalDialog } from './ConsoleStoryTaskCreateModalDialog';

type RowReorderState = {
  inProgress: boolean;
  error: string | null;
};

export type ConsoleStoryTaskActions = {
  onSetStory: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  onSetAgent: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  onSetStatus: (
    item: ConsoleListItem,
    option: ConsoleFieldOption,
  ) => Promise<void>;
  onSetDependedIssueUrl: (
    item: ConsoleListItem,
    dependedIssueUrl: string,
  ) => Promise<void>;
  onSetNextActionDate: (
    item: ConsoleListItem,
    nextActionDate: string,
  ) => Promise<void>;
  onSetNextActionHour: (
    item: ConsoleListItem,
    nextActionHour: number | null,
  ) => Promise<void>;
};

type StoryTaskListProps = {
  items: ConsoleListItem[];
  storyOptions: ConsoleFieldOption[];
  currentStoryOptionId: string;
  agentOptions: ConsoleFieldOption[];
  statusOptions: ConsoleFieldOption[];
  hiddenRowFields: ConsoleStoryRowField[];
  onOpenItem: (item: ConsoleListItem) => void;
  actions: ConsoleStoryTaskActions;
};

type StoryTaskRowProps = Omit<StoryTaskListProps, 'items'> & {
  item: ConsoleListItem;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour);

const isRowFieldShown = (
  hiddenRowFields: ConsoleStoryRowField[],
  field: ConsoleStoryRowField,
): boolean => !hiddenRowFields.includes(field);

const toDateInputValue = (value: string | null): string =>
  value === null ? '' : value.slice(0, 10);

const isCompleteIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const toErrorMessage = (caught: unknown): string =>
  caught instanceof Error ? caught.message : String(caught);

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

const StoryTaskRow = ({
  item,
  storyOptions,
  currentStoryOptionId,
  agentOptions,
  statusOptions,
  hiddenRowFields,
  onOpenItem,
  actions,
}: StoryTaskRowProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const runChange = (change: () => Promise<void>) => {
    setPending(true);
    setError(null);
    change().then(
      () => setPending(false),
      (caught: unknown) => {
        setPending(false);
        setError(toErrorMessage(caught));
        setRevision((current) => current + 1);
      },
    );
  };

  const dependedIssueUrlsText = item.dependedIssueUrls.join(', ');
  const currentStatusOption =
    statusOptions.find((option) => option.name === item.status) ?? null;

  const commitDependedIssueUrls = (value: string) => {
    const urls = parseDependedIssueUrlsInput(value);
    if (urls.join(', ') === dependedIssueUrlsText) {
      return;
    }
    runChange(() => actions.onSetDependedIssueUrl(item, urls.join(', ')));
  };

  const storedDateValue = toDateInputValue(item.nextActionDate);
  const showDependedIssueUrl = isRowFieldShown(
    hiddenRowFields,
    'dependedIssueUrl',
  );
  const showNextActionDate = isRowFieldShown(hiddenRowFields, 'nextActionDate');
  const showNextActionHour = isRowFieldShown(hiddenRowFields, 'nextActionHour');

  // The date input is a draft: a partial, empty, or unchanged value is never
  // sent. Only a complete YYYY-MM-DD different from the stored date commits.
  const commitNextActionDate = (input: HTMLInputElement) => {
    const draft = input.value;
    if (draft === storedDateValue) {
      return;
    }
    if (!isCompleteIsoDate(draft)) {
      input.value = storedDateValue;
      return;
    }
    runChange(() => actions.onSetNextActionDate(item, draft));
  };

  return (
    <li className="console-story-task-row">
      <button
        type="button"
        className="console-story-task-title"
        onClick={() => onOpenItem(item)}
      >
        {item.title}
      </button>
      <div className="console-story-task-ops">
        {(showDependedIssueUrl || showNextActionDate || showNextActionHour) && (
          <div className="console-op-group console-story-task-trigger">
            {showDependedIssueUrl && (
              <input
                key={`depended-${dependedIssueUrlsText}-${revision}`}
                type="text"
                className="console-story-task-depended-input"
                aria-label="Set depended issue URL"
                placeholder="Depended issue URL"
                defaultValue={dependedIssueUrlsText}
                disabled={pending}
                onBlur={(event) =>
                  commitDependedIssueUrls(event.currentTarget.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            )}
            {showNextActionDate && (
              <>
                <input
                  key={`date-${storedDateValue}-${revision}`}
                  type="date"
                  className="console-story-task-date-input"
                  aria-label="Set next action date"
                  defaultValue={storedDateValue}
                  disabled={pending}
                  onBlur={(event) => commitNextActionDate(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                {item.nextActionDate !== null && (
                  <button
                    type="button"
                    className="console-story-task-date-clear"
                    aria-label="Clear next action date"
                    disabled={pending}
                    onClick={() =>
                      runChange(() => actions.onSetNextActionDate(item, ''))
                    }
                  >
                    Clear
                  </button>
                )}
              </>
            )}
            {showNextActionHour && (
              <select
                className="console-story-task-hour-select"
                aria-label="Set next action hour"
                value={
                  item.nextActionHour === null
                    ? ''
                    : String(item.nextActionHour)
                }
                disabled={pending}
                onChange={(event) => {
                  const next = event.target.value;
                  const current =
                    item.nextActionHour === null
                      ? ''
                      : String(item.nextActionHour);
                  if (next === current) {
                    return;
                  }
                  runChange(() =>
                    actions.onSetNextActionHour(
                      item,
                      next === '' ? null : Number(next),
                    ),
                  );
                }}
              >
                <option value="">— hour —</option>
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour} value={String(hour)}>
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {isRowFieldShown(hiddenRowFields, 'agent') && (
          <div key={`agent-${revision}`} className="console-story-task-field">
            <ConsoleAgentSelectActions
              agentOptions={agentOptions}
              currentAgentName={item.agent}
              currentAgentOptionId={item.agentOptionId ?? null}
              onSetAgent={(option) =>
                runChange(() => actions.onSetAgent(item, option))
              }
              disabled={pending}
            />
          </div>
        )}
        {isRowFieldShown(hiddenRowFields, 'story') && (
          <ConsoleStorySelectActions
            key={`story-${revision}`}
            storyOptions={storyOptions}
            currentStoryName={null}
            currentStoryOptionId={currentStoryOptionId}
            onSetStory={(option) =>
              runChange(() => actions.onSetStory(item, option))
            }
            disabled={pending}
          />
        )}
        {isRowFieldShown(hiddenRowFields, 'status') && (
          <div
            key={`status-${revision}`}
            className="console-op-group console-story-task-field"
          >
            <ConsoleFieldOptionSelect
              className="console-story-task-status-select"
              ariaLabel="Set status"
              placeholder="— status —"
              currentOption={currentStatusOption}
              options={statusOptions}
              onSelect={(option) =>
                runChange(() => actions.onSetStatus(item, option))
              }
              disabled={pending}
            />
          </div>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="console-list-error console-story-task-error">
          {error}
        </p>
      )}
    </li>
  );
};

const StoryTaskList = ({
  items,
  storyOptions,
  currentStoryOptionId,
  agentOptions,
  statusOptions,
  hiddenRowFields,
  onOpenItem,
  actions,
}: StoryTaskListProps) => (
  <ul className="console-story-task-list">
    {items.map((item) => (
      <StoryTaskRow
        key={item.url}
        item={item}
        storyOptions={storyOptions}
        currentStoryOptionId={currentStoryOptionId}
        agentOptions={agentOptions}
        statusOptions={statusOptions}
        hiddenRowFields={hiddenRowFields}
        onOpenItem={onOpenItem}
        actions={actions}
      />
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
  selectedStatuses?: string[];
  statusOptionNames?: string[];
  onToggleStatus?: (status: string) => void;
  onClearStatuses?: () => void;
  agentOptions: ConsoleFieldOption[];
  statusFieldOptions: ConsoleFieldOption[];
  hiddenRowFields: ConsoleStoryRowField[];
  onToggleRowField: (field: ConsoleStoryRowField) => void;
  taskActions: ConsoleStoryTaskActions;
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
  selectedStatuses = [],
  statusOptionNames = [],
  onToggleStatus,
  onClearStatuses,
  agentOptions,
  statusFieldOptions,
  hiddenRowFields,
  onToggleRowField,
  taskActions,
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

  const effectiveStatusSelection = resolveEffectiveConsoleStoryStatusSelection(
    selectedStatuses,
    statusOptionNames,
  );
  const hasStatusSelection = effectiveStatusSelection.length > 0;
  const reorderLockTitle = hasStatusSelection
    ? 'Clear the status filter to reorder stories'
    : undefined;
  const archiveVisibleStories = stories.filter(
    (entry) => showArchived || entry.color !== 'GRAY',
  );
  const visibleStories = filterConsoleStoryEntriesByStatusSelection(
    archiveVisibleStories,
    effectiveStatusSelection,
  );

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
  const storyFieldOptions: ConsoleFieldOption[] = archiveVisibleStories.map(
    (entry) => ({
      id: entry.storyOptionId,
      name: entry.storyName,
      color: entry.color,
    }),
  );

  return (
    <div className="console-story-list-container">
      <div className="console-story-filter-bar">
        {statusOptionNames.length > 0 &&
          onToggleStatus !== undefined &&
          onClearStatuses !== undefined && (
            <ConsoleStoryStatusFilter
              statusNames={statusOptionNames}
              selectedStatuses={selectedStatuses}
              onToggleStatus={onToggleStatus}
              onClearStatuses={onClearStatuses}
            />
          )}
        <ConsoleStoryRowFieldToggles
          hiddenFields={hiddenRowFields}
          onToggle={onToggleRowField}
        />
      </div>
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
            const visibleTaskItems = hasStatusSelection
              ? (entry.items ?? [])
              : (entry.items ?? []).filter(
                  (item) => showDone || item.status !== 'Done',
                );
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
                    disabled={
                      isFirst || reorderInProgress || hasStatusSelection
                    }
                    title={reorderLockTitle}
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
                    disabled={isLast || reorderInProgress || hasStatusSelection}
                    title={reorderLockTitle}
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
                  <StoryTaskList
                    items={visibleTaskItems}
                    storyOptions={storyFieldOptions}
                    currentStoryOptionId={entry.storyOptionId}
                    agentOptions={agentOptions}
                    statusOptions={statusFieldOptions}
                    hiddenRowFields={hiddenRowFields}
                    onOpenItem={onOpenItem}
                    actions={taskActions}
                  />
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
