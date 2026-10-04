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
  files?: File[];
};

export type IssueCreateDestination = 'project' | 'workflow';

export type IssueCreateModalDialogProps = {
  storyEntries: ConsoleStoryEntry[];
  agentOptions: ConsoleFieldOption[];
  workflowStoryEntries?: ConsoleStoryEntry[];
  workflowAgentOptions?: ConsoleFieldOption[];
  initialDestination: IssueCreateDestination;
  onSubmitProject: (params: IssueCreateParams) => Promise<void>;
  onSubmitWorkflow?: (params: IssueCreateParams) => Promise<void>;
  onClose: () => void;
  initialDraft?: IssueCreateDraft;
  initialSubmitError?: string | null;
  onDraftChange?: (draft: IssueCreateDraft) => void;
  fleetTaskCreateUrl?: string | null;
  newIssueUrl?: string | null;
  containerClassName?: string;
};

export const IssueCreateModalDialog = ({
  storyEntries,
  agentOptions,
  workflowStoryEntries,
  workflowAgentOptions,
  initialDestination,
  onSubmitProject,
  onSubmitWorkflow,
  onClose,
  initialDraft,
  initialSubmitError,
  onDraftChange,
  fleetTaskCreateUrl,
  newIssueUrl,
  containerClassName,
}: IssueCreateModalDialogProps) => {
  const [destination, setDestination] =
    useState<IssueCreateDestination>(initialDestination);
  const activeStoryEntries =
    destination === 'workflow'
      ? workflowStoryEntries ?? storyEntries
      : storyEntries;
  const activeAgentOptions =
    destination === 'workflow'
      ? workflowAgentOptions ?? agentOptions
      : agentOptions;
  const [selectedStoryOptionId, setSelectedStoryOptionId] = useState<
    string | null
  >(() => {
    if (initialDraft?.storyName) {
      const match = activeStoryEntries.find(
        (e) => e.storyName === initialDraft.storyName,
      );
      if (match) return match.storyOptionId;
    }
    return activeStoryEntries[0]?.storyOptionId ?? null;
  });
  const [selectedAgentOptionId, setSelectedAgentOptionId] = useState<
    string | null
  >(initialDraft?.agentOptionId ?? null);
  const [titleValue, setTitleValue] = useState(initialDraft?.title ?? '');
  const [bodyValue, setBodyValue] = useState(initialDraft?.body ?? '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>(
    initialDraft?.files ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    initialSubmitError ?? null,
  );
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const previousStoryEntriesForResetRef = useRef(storyEntries);
  useEffect(() => {
    const storyEntriesChanged =
      previousStoryEntriesForResetRef.current !== storyEntries;
    previousStoryEntriesForResetRef.current = storyEntries;
    if (!storyEntriesChanged || destination !== 'project') {
      return;
    }
    if (
      selectedStoryOptionId === null ||
      !storyEntries.some((e) => e.storyOptionId === selectedStoryOptionId)
    ) {
      setSelectedStoryOptionId(storyEntries[0]?.storyOptionId ?? null);
    }
  }, [storyEntries, selectedStoryOptionId, destination]);

  const previousDestinationForClearRef = useRef(destination);
  useEffect(() => {
    const destinationChanged =
      previousDestinationForClearRef.current !== destination;
    previousDestinationForClearRef.current = destination;
    if (!destinationChanged) {
      return;
    }
    if (
      selectedStoryOptionId !== null &&
      !activeStoryEntries.some((e) => e.storyOptionId === selectedStoryOptionId)
    ) {
      setSelectedStoryOptionId(null);
    }
    if (
      selectedAgentOptionId !== null &&
      !activeAgentOptions.some((o) => o.id === selectedAgentOptionId)
    ) {
      setSelectedAgentOptionId(null);
    }
  }, [
    destination,
    activeStoryEntries,
    activeAgentOptions,
    selectedStoryOptionId,
    selectedAgentOptionId,
  ]);

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
    activeStoryEntries.find((e) => e.storyOptionId === selectedStoryOptionId)
      ?.storyName ?? null;

  const handleSubmit = async (): Promise<void> => {
    const trimmedTitle = titleValue.trim();
    if (trimmedTitle.length === 0) {
      setSubmitError('Title is required.');
      return;
    }
    const storyName = resolvedStoryName();
    if (storyName === null && activeStoryEntries.length > 0) {
      setSubmitError('Please select a story.');
      return;
    }
    const trimmedBody = bodyValue.trim();
    const MAX_TITLE_LENGTH = 256;
    const finalTitle =
      trimmedTitle.length > MAX_TITLE_LENGTH
        ? trimmedTitle.slice(0, MAX_TITLE_LENGTH)
        : trimmedTitle;
    const titleOverflow =
      trimmedTitle.length > MAX_TITLE_LENGTH
        ? trimmedTitle.slice(MAX_TITLE_LENGTH)
        : '';
    const finalBody =
      titleOverflow.length > 0
        ? trimmedBody.length > 0
          ? `${titleOverflow}\n${trimmedBody}`
          : titleOverflow
        : trimmedBody.length > 0
          ? trimmedBody
          : null;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const submitParams = {
        storyName,
        agentOptionId: selectedAgentOptionId,
        title: finalTitle,
        body: finalBody,
        files: selectedFiles,
      };
      if (destination === 'project') {
        await onSubmitProject(submitParams);
      } else {
        if (onSubmitWorkflow === undefined) {
          throw new Error('No workflow repository is configured.');
        }
        await onSubmitWorkflow(submitParams);
      }
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
    <div
      className={`console-task-create-dialog-container${containerClassName !== undefined ? ` ${containerClassName}` : ''}`}
    >
      <button
        type="button"
        className="console-task-create-dialog-overlay"
        aria-label="Close dialog"
        disabled={submitting}
        onClick={onClose}
      />
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
            {newIssueUrl != null && (
              <a
                href={newIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="console-task-create-dialog-new-issue-link"
              >
                New tab
              </a>
            )}
            <div className="console-task-create-dialog-destination-selector">
              <button
                type="button"
                className={`console-task-create-dialog-option-button${destination === 'project' ? ' console-task-create-dialog-option-button--selected' : ''}`}
                aria-pressed={destination === 'project'}
                onClick={() => setDestination('project')}
                disabled={submitting}
              >
                Project
              </button>
              {onSubmitWorkflow !== undefined && (
                <button
                  type="button"
                  className={`console-task-create-dialog-option-button${destination === 'workflow' ? ' console-task-create-dialog-option-button--selected' : ''}`}
                  aria-pressed={destination === 'workflow'}
                  onClick={() => setDestination('workflow')}
                  disabled={submitting}
                >
                  Workflow
                </button>
              )}
            </div>
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

          {activeStoryEntries.length > 0 && (
            <>
              <span className="console-task-create-dialog-section-label">
                Story
              </span>
              <div className="console-task-create-dialog-option-list">
                {activeStoryEntries.map((entry) => (
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
            </>
          )}

          {activeAgentOptions.length > 0 && (
            <>
              <span className="console-task-create-dialog-section-label">
                Agent
              </span>
              <div className="console-task-create-dialog-option-list">
                {activeAgentOptions.map((option) => (
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
        </div>
        <div className="console-task-create-dialog-footer">
          <div className="console-task-create-dialog-actions">
            <button
              type="button"
              className="console-task-create-dialog-cancel"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="console-task-create-dialog-submit"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
