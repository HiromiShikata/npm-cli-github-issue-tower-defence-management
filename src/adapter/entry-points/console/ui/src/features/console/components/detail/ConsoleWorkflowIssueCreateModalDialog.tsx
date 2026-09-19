import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ConsoleWorkflowIssueCreateModalDialogProps = {
  defaultTitle: string;
  defaultBody: string;
  onSubmit: (title: string, body: string) => Promise<void>;
  onClose: () => void;
};

export const ConsoleWorkflowIssueCreateModalDialog = ({
  defaultTitle,
  defaultBody,
  onSubmit,
  onClose,
}: ConsoleWorkflowIssueCreateModalDialogProps) => {
  const [titleValue, setTitleValue] = useState(defaultTitle);
  const [bodyValue, setBodyValue] = useState(defaultBody);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(titleValue, bodyValue);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="console-workflow-issue-create-dialog-container">
      <button
        type="button"
        className="console-workflow-issue-create-dialog-overlay"
        aria-label="Close dialog"
        disabled={submitting}
        onClick={onClose}
      />
      <div
        className="console-workflow-issue-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Create workflow improvement issue"
      >
        <div className="console-workflow-issue-create-dialog-bar">
          <span className="console-workflow-issue-create-dialog-title">
            Create workflow improvement issue
          </span>
          <button
            type="button"
            className="console-workflow-issue-create-dialog-close"
            aria-label="Close"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        <div className="console-workflow-issue-create-dialog-body">
          <span className="console-workflow-issue-create-dialog-section-label">
            Title
          </span>
          <textarea
            ref={titleRef}
            className="console-workflow-issue-create-dialog-textarea"
            aria-label="Title"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            disabled={submitting}
            rows={3}
          />
          <span className="console-workflow-issue-create-dialog-section-label">
            Body
          </span>
          <textarea
            className="console-workflow-issue-create-dialog-textarea"
            aria-label="Body"
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
            disabled={submitting}
            rows={6}
          />
          {submitError !== null && (
            <p role="alert" className="console-list-error">
              {submitError}
            </p>
          )}
          <div className="console-workflow-issue-create-dialog-actions">
            <button
              type="button"
              className="console-workflow-issue-create-dialog-cancel"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="console-workflow-issue-create-dialog-submit"
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
