import { useEffect, useRef, useState } from 'react';

export type ConsoleStoryCreateModalDialogProps = {
  onSubmit: (storyName: string) => Promise<void>;
  onClose: () => void;
};

export const ConsoleStoryCreateModalDialog = ({
  onSubmit,
  onClose,
}: ConsoleStoryCreateModalDialogProps) => {
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    const trimmed = nameInput.trim();
    if (trimmed.length === 0) {
      setSubmitError('Story name is required');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(trimmed);
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
      aria-label="Add story"
    >
      <button
        type="button"
        className="console-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="console-modal-inner">
        <h2 className="console-modal-title">Add story</h2>
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
            placeholder="Story name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
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
          </div>
        </form>
      </div>
    </div>
  );
};
