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

export type IssueCreateDraft = {
  title: string;
  body: string;
  storyName: string | null;
  agentOptionId: string | null;
};

export type IssueCreateModalDialogProps = {
  storyEntries: ConsoleStoryEntry[];
  agentOptions: ConsoleFieldOption[];
  onSubmit: (params: IssueCreateParams) => Promise<void>;
  onClose: () => void;
  fleetTaskCreateUrl?: string | null;
  initialDraft?: IssueCreateDraft | null;
  onDraftChange?: (draft: IssueCreateDraft) => void;
};

export const IssueCreateModalDialog = ({
  storyEntries,
  agentOptions,
  onSubmit,
  onClose,
  fleetTaskCreateUrl = null,
  initialDraft,
  onDraftChange,
}: IssueCreateModalDialogProps) => {
  const [selectedStoryName, setSelectedStoryName] = useState<string | null>(
    initialDraft != null
      ? initialDraft.storyName
      : (storyEntries[0]?.storyName ?? null),
  );
  const [selectedAgentOptionId, setSelectedAgentOptionId] = useState<
    string | null
  >(initialDraft?.agentOptionId ?? null);
  const [titleValue, setTitleValue] = useState(initialDraft?.title ?? '');
  const [bodyValue, setBodyValue] = useState(initialDraft?.body ?? '');
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ id: string; file: File }>
  >([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    onDraftChangeRef.current?.({
      title: titleValue,
      body: bodyValue,
      storyName: selectedStoryName,
      agentOptionId: selectedAgentOptionId,
    });
  }, [titleValue, bodyValue, selectedStoryName, selectedAgentOptionId]);

  useEffect(() => {
    const urls = new Map<string, string>();
    for (const entry of selectedFiles) {
      if (entry.file.type.startsWith('image/')) {
        urls.set(entry.id, URL.createObjectURL(entry.file));
      }
    }
    setThumbnailUrls(urls);
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [selectedFiles]);

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
        files: selectedFiles.map((entry) => entry.file),
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
          <div className="console-task-create-dialog-bar-actions">
            {fleetTaskCreateUrl !== null && (
              <a
                href={fleetTaskCreateUrl}
                target="_blank"
                rel="noreferrer"
                className="console-task-create-dialog-open-link"
                aria-label="Open in new tab"
              >
                ↗
              </a>
            )}
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
            ref={fileInputRef}
            type="file"
            multiple
            className="console-task-create-dialog-file-input"
            disabled={submitting}
            onChange={(e) => {
              const newEntries = Array.from(e.target.files ?? []).map(
                (file) => ({ id: crypto.randomUUID(), file }),
              );
              setSelectedFiles((prev) => [...prev, ...newEntries]);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
          />
          {selectedFiles.length > 0 && (
            <ul className="console-task-create-dialog-file-list">
              {selectedFiles.map((entry) => {
                const rawThumb = thumbnailUrls.get(entry.id);
                const thumbnailSrc =
                  rawThumb?.startsWith('blob:') === true ? rawThumb : null;
                return (
                  <li
                    key={entry.id}
                    className="console-task-create-dialog-file-item"
                  >
                    {thumbnailSrc !== null && (
                      <img
                        src={thumbnailSrc}
                        alt={entry.file.name}
                        className="console-task-create-dialog-file-thumbnail"
                      />
                    )}
                    <span className="console-task-create-dialog-file-name">
                      {entry.file.name}
                    </span>
                    <button
                      type="button"
                      className="console-task-create-dialog-file-remove"
                      aria-label={`Remove ${entry.file.name}`}
                      onClick={() =>
                        setSelectedFiles((prev) =>
                          prev.filter((e) => e.id !== entry.id),
                        )
                      }
                      disabled={submitting}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

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
