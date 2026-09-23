import { useEffect, useRef, useState } from 'react';

export type ConsoleStoryTaskCreateModalDialogProps = {
  storyName: string;
  onSubmit: (storyName: string, title: string) => Promise<void>;
  onClose: () => void;
  onEdit?: (storyName: string, title: string) => void;
};

export const ConsoleStoryTaskCreateModalDialog = ({
  storyName,
  onSubmit,
  onClose,
  onEdit,
}: ConsoleStoryTaskCreateModalDialogProps) => {
  const [titleInput, setTitleInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (): Promise<void> => {
    const trimmed = titleInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Title is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(storyName, trimmed);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="console-modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`Add task to ${storyName}`}
    >
      <button
        type="button"
        className="console-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="console-modal-inner">
        <h2 className="console-modal-title">Add task to {storyName}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="console-modal-input"
            placeholder="Issue title"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            disabled={submitting}
          />
          {submitError !== null && (
            <p role="alert" className="console-list-error">
              {submitError}
            </p>
          )}
          <div className="console-modal-actions">
            <button
              type="submit"
              className="console-op-button"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              className="console-op-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            {submitError !== null && onEdit !== undefined && (
              <button
                type="button"
                className="console-op-button"
                onClick={() => {
                  onEdit(storyName, titleInput);
                  onClose();
                }}
                disabled={submitting}
              >
                Edit
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
