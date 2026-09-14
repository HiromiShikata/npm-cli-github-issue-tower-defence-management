import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleStoryEntry } from '../../logic/types';

export type IssueCreateParams = {
  storyOptionId: string;
  title: string;
};

export type IssueCreateModalDialogProps = {
  storyEntries: ConsoleStoryEntry[];
  onSubmit: (params: IssueCreateParams) => void;
  onClose: () => void;
  initialTitle?: string;
  onTitleChange?: (title: string) => void;
};

export const IssueCreateModalDialog = ({
  storyEntries,
  onSubmit,
  onClose,
  initialTitle,
  onTitleChange,
}: IssueCreateModalDialogProps) => {
  const [selectedStoryOptionId, setSelectedStoryOptionId] = useState<
    string | null
  >(storyEntries[0]?.storyOptionId ?? null);
  const [titleValue, setTitleValue] = useState(initialTitle ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (
      selectedStoryOptionId === null ||
      !storyEntries.some((e) => e.storyOptionId === selectedStoryOptionId)
    ) {
      setSelectedStoryOptionId(storyEntries[0]?.storyOptionId ?? null);
    }
  }, [storyEntries, selectedStoryOptionId]);

  const handleSubmit = (): void => {
    const trimmedTitle = titleValue.trim();
    if (trimmedTitle.length === 0) {
      setValidationError('Title is required.');
      return;
    }
    if (selectedStoryOptionId === null) {
      setValidationError('Please select a story.');
      return;
    }
    onSubmit({ storyOptionId: selectedStoryOptionId, title: trimmedTitle });
    onClose();
  };

  return createPortal(
    <div className="console-task-create-dialog-overlay">
      <div
        className="console-task-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Create new task"
      >
        <div className="console-task-create-dialog-bar">
          <span className="console-task-create-dialog-title">
            Create new task
          </span>
          <div className="console-task-create-dialog-bar-actions">
            <button
              type="button"
              className="console-task-create-dialog-close"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="console-task-create-dialog-body">
          <span className="console-task-create-dialog-section-label">
            Title
          </span>
          <textarea
            ref={titleRef}
            className="console-task-create-dialog-textarea"
            aria-label="Title"
            value={titleValue}
            onChange={(e) => {
              setTitleValue(e.target.value);
              onTitleChange?.(e.target.value);
            }}
            rows={3}
          />

          <span className="console-task-create-dialog-section-label">
            Story
          </span>
          <div className="console-task-create-dialog-option-list">
            {storyEntries.map((entry) => (
              <button
                key={entry.storyOptionId}
                type="button"
                className={`console-task-create-dialog-option-button${selectedStoryOptionId === entry.storyOptionId ? ' console-task-create-dialog-option-button--selected' : ''}`}
                aria-pressed={selectedStoryOptionId === entry.storyOptionId}
                onClick={() => setSelectedStoryOptionId(entry.storyOptionId)}
              >
                <span
                  className="console-story-dot"
                  style={{
                    backgroundColor: colorFromEnum(entry.color).dot,
                  }}
                />
                {entry.storyName}
              </button>
            ))}
          </div>

          {validationError !== null && (
            <p role="alert" className="console-list-error">
              {validationError}
            </p>
          )}

          <div className="console-task-create-dialog-actions">
            <button
              type="button"
              className="console-task-create-dialog-submit"
              onClick={handleSubmit}
            >
              Create
            </button>
            <button
              type="button"
              className="console-task-create-dialog-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
