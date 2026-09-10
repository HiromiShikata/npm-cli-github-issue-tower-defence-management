import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';

export type IssueCreateParams = {
  storyName: string;
  agentOptionId: string | null;
  title: string;
  body: string | null;
  files: File[];
};

export type IssueCreateModalDialogProps = {
  storyEntries: ConsoleStoryEntry[];
  agentOptions: ConsoleFieldOption[];
  onSubmit: (params: IssueCreateParams) => Promise<void>;
  onClose: () => void;
};

export const IssueCreateModalDialog = ({
  storyEntries,
  agentOptions,
  onSubmit,
  onClose,
}: IssueCreateModalDialogProps) => {
  const [selectedStoryName, setSelectedStoryName] = useState<string | null>(
    storyEntries[0]?.storyName ?? null,
  );
  const [selectedAgentOptionId, setSelectedAgentOptionId] = useState<
    string | null
  >(null);
  const [titleValue, setTitleValue] = useState('');
  const [bodyValue, setBodyValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const trimmedTitle = titleValue.trim();
    if (trimmedTitle.length === 0) {
      setSubmitError('Title is required.');
      return;
    }
    if (selectedStoryName === null) {
      setSubmitError('Please select a story.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const trimmedBody = bodyValue.trim();
      await onSubmit({
        storyName: selectedStoryName,
        agentOptionId: selectedAgentOptionId,
        title: trimmedTitle,
        body: trimmedBody.length > 0 ? trimmedBody : null,
        files: selectedFiles,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
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
          <button
            type="button"
            className="console-task-create-dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
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
            onChange={(e) => setTitleValue(e.target.value)}
            disabled={submitting}
            rows={3}
          />

          <span className="console-task-create-dialog-section-label">Body</span>
          <textarea
            className="console-task-create-dialog-textarea"
            aria-label="Body"
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
            disabled={submitting}
            rows={4}
          />

          <span className="console-task-create-dialog-section-label">
            Attachments
          </span>
          <input
            type="file"
            multiple
            className="console-task-create-dialog-file-input"
            disabled={submitting}
            onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
          />

          <span className="console-task-create-dialog-section-label">
            Story
          </span>
          <div className="console-task-create-dialog-option-list">
            {storyEntries.map((entry) => (
              <button
                key={entry.storyOptionId}
                type="button"
                className={`console-task-create-dialog-option-button${selectedStoryName === entry.storyName ? ' console-task-create-dialog-option-button--selected' : ''}`}
                aria-pressed={selectedStoryName === entry.storyName}
                onClick={() => setSelectedStoryName(entry.storyName)}
                disabled={submitting}
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

          {agentOptions.length > 0 && (
            <>
              <span className="console-task-create-dialog-section-label">
                Agent
              </span>
              <div className="console-task-create-dialog-option-list">
                {agentOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`console-task-create-dialog-option-button${selectedAgentOptionId === option.id ? ' console-task-create-dialog-option-button--selected' : ''}`}
                    aria-pressed={selectedAgentOptionId === option.id}
                    onClick={() =>
                      setSelectedAgentOptionId(
                        selectedAgentOptionId === option.id ? null : option.id,
                      )
                    }
                    disabled={submitting}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {submitError !== null && (
            <p role="alert" className="console-list-error">
              {submitError}
            </p>
          )}

          <div className="console-task-create-dialog-actions">
            <button
              type="button"
              className="console-task-create-dialog-submit"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="console-task-create-dialog-cancel"
              disabled={submitting}
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
