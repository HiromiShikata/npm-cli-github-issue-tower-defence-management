import { useEffect, useRef, useState } from 'react';
import type { ConsoleStoryEntry } from '../../logic/types';

export type ConsoleTaskCreateButtonProps = {
  pjcode: string;
  storyEntries: ConsoleStoryEntry[];
  defaultNameWithOwner: string | null;
  onCreateIssue: (storyOptionId: string, title: string) => Promise<void>;
};

export const ConsoleTaskCreateButton = ({
  pjcode: _pjcode,
  storyEntries,
  defaultNameWithOwner,
  onCreateIssue,
}: ConsoleTaskCreateButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStoryOptionId, setSelectedStoryOptionId] = useState<
    string | null
  >(null);
  const [titleInput, setTitleInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const disabled = defaultNameWithOwner === null || storyEntries.length === 0;

  const openForm = () => {
    setSelectedStoryOptionId(storyEntries[0]?.storyOptionId ?? null);
    setTitleInput('');
    setSubmitError(null);
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      titleInputRef.current?.focus();
    }
  }, [isOpen]);

  const handleCancel = () => {
    setIsOpen(false);
    setTitleInput('');
    setSubmitError(null);
  };

  const handleSubmit = async (): Promise<void> => {
    if (selectedStoryOptionId === null) {
      setSubmitError('Please select a story.');
      return;
    }
    const trimmed = titleInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Title is required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onCreateIssue(selectedStoryOptionId, trimmed);
      setIsOpen(false);
      setTitleInput('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="console-task-create-button"
        disabled={disabled}
        onClick={openForm}
        aria-label="Create new task"
      >
        + New task
      </button>
    );
  }

  return (
    <form
      className="console-task-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <select
        className="console-task-create-form-select"
        value={selectedStoryOptionId ?? ''}
        onChange={(e) => setSelectedStoryOptionId(e.target.value)}
        disabled={submitting}
        aria-label="Story"
      >
        {storyEntries.map((entry) => (
          <option key={entry.storyOptionId} value={entry.storyOptionId}>
            {entry.storyName}
          </option>
        ))}
      </select>
      <input
        ref={titleInputRef}
        type="text"
        className="console-task-create-form-input"
        placeholder="Issue title"
        value={titleInput}
        onChange={(e) => setTitleInput(e.target.value)}
        disabled={submitting}
        aria-label="Issue title"
      />
      <button
        type="submit"
        className="console-task-create-form-submit"
        disabled={submitting}
      >
        {submitting ? 'Creating…' : 'Create'}
      </button>
      <button
        type="button"
        className="console-task-create-form-cancel"
        onClick={handleCancel}
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
