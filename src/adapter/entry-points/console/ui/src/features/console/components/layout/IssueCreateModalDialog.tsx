import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colorFromEnum } from '../../logic/colors';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';

export type IssueCreateParams = {
  storyName: string | null;
  agentOptionId: string | null;
  title: string;
  body: string | null;
  files: File[];
};

export type IssueCreateDraft = {
  title: string;
  body: string | null;
  storyName: string | null;
  agentOptionId: string | null;
};

export type IssueCreateModalDialogProps = {
  storyEntries: ConsoleStoryEntry[];
  agentOptions: ConsoleFieldOption[];
  onSubmit: (params: IssueCreateParams) => Promise<void>;
  onClose: () => void;
  initialDraft?: IssueCreateDraft;
  onDraftChange?: (draft: IssueCreateDraft) => void;
  fleetTaskCreateUrl?: string | null;
};

export const IssueCreateModalDialog = ({
  storyEntries,
  agentOptions,
  onSubmit,
  onClose,
  initialDraft,
  onDraftChange,
  fleetTaskCreateUrl,
}: IssueCreateModalDialogProps) => {
  const [selectedStoryOptionId, setSelectedStoryOptionId] = useState<
    string | null
  >(() => {
    if (initialDraft?.storyName) {
      const match = storyEntries.find(
        (e) => e.storyName === initialDraft.storyName,
      );
      if (match) return match.storyOptionId;
    }
    return storyEntries[0]?.storyOptionId ?? null;
  });
  const [selectedAgentOptionId, setSelectedAgentOptionId] = useState<
    string | null
  >(initialDraft?.agentOptionId ?? null);
  const [titleValue, setTitleValue] = useState(initialDraft?.title ?? '');
  const [bodyValue, setBodyValue] = useState(initialDraft?.body ?? '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  const [thumbnailUrls, setThumbnailUrls] = useState<Map<File, string>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith('image/'),
    );
    const reads = imageFiles.map(
      (file) =>
        new Promise<[File, string]>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve([file, reader.result]);
            } else {
              resolve([file, '']);
            }
          };
          reader.readAsDataURL(file);
        }),
    );
    void Promise.all(reads).then((entries) => {
      if (!cancelled) {
        setThumbnailUrls(new Map(entries.filter(([, url]) => url.length > 0)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFiles]);

  const resolvedStoryName = (): string | null =>
    storyEntries.find((e) => e.storyOptionId === selectedStoryOptionId)
      ?.storyName ?? null;

  const handleSubmit = async (): Promise<void> => {
    const trimmedTitle = titleValue.trim();
    if (trimmedTitle.length === 0) {
      setSubmitError('Title is required.');
      return;
    }
    const storyName = resolvedStoryName();
    if (storyName === null && storyEntries.length > 0) {
      setSubmitError('Please select a story.');
      return;
    }
    const trimmedBody = bodyValue.trim();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        storyName,
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

  const handleRemoveFile = (index: number): void => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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
            {fleetTaskCreateUrl != null && (
              <a
                href={fleetTaskCreateUrl}
                target="_blank"
                rel="noreferrer"
                className="console-task-create-dialog-fleet-link"
              >
                Fleet
              </a>
            )}
            <button
              type="button"
              className="console-task-create-dialog-close"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
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
              onDraftChange?.({
                title: e.target.value,
                body: bodyValue.trim().length > 0 ? bodyValue : null,
                storyName: resolvedStoryName(),
                agentOptionId: selectedAgentOptionId,
              });
            }}
            disabled={submitting}
            rows={3}
          />

          <span className="console-task-create-dialog-section-label">Body</span>
          <textarea
            className="console-task-create-dialog-textarea"
            aria-label="Body"
            value={bodyValue}
            onChange={(e) => {
              setBodyValue(e.target.value);
              onDraftChange?.({
                title: titleValue,
                body: e.target.value.trim().length > 0 ? e.target.value : null,
                storyName: resolvedStoryName(),
                agentOptionId: selectedAgentOptionId,
              });
            }}
            disabled={submitting}
            rows={3}
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
          {selectedFiles.length > 0 && (
            <ul className="console-task-create-dialog-file-list">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="console-task-create-dialog-file-item"
                >
                  {thumbnailUrls.has(file) && (
                    <img
                      src={thumbnailUrls.get(file)}
                      alt={file.name}
                      className="console-task-create-dialog-file-thumbnail"
                    />
                  )}
                  <span className="console-task-create-dialog-file-name">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="console-task-create-dialog-file-remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => handleRemoveFile(index)}
                    disabled={submitting}
                  >
                    ✕
                  </button>
                </li>
              ))}
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
                className={`console-task-create-dialog-option-button${selectedStoryOptionId === entry.storyOptionId ? ' console-task-create-dialog-option-button--selected' : ''}`}
                aria-pressed={selectedStoryOptionId === entry.storyOptionId}
                onClick={() => {
                  setSelectedStoryOptionId(entry.storyOptionId);
                  onDraftChange?.({
                    title: titleValue,
                    body: bodyValue.trim().length > 0 ? bodyValue : null,
                    storyName: entry.storyName,
                    agentOptionId: selectedAgentOptionId,
                  });
                }}
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
                    onClick={() => {
                      const newAgentId =
                        selectedAgentOptionId === option.id ? null : option.id;
                      setSelectedAgentOptionId(newAgentId);
                      onDraftChange?.({
                        title: titleValue,
                        body: bodyValue.trim().length > 0 ? bodyValue : null,
                        storyName: resolvedStoryName(),
                        agentOptionId: newAgentId,
                      });
                    }}
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
