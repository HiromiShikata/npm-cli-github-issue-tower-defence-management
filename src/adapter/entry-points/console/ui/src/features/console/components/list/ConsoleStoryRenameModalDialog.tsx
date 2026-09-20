import { useEffect, useRef, useState } from 'react';

export type ConsoleStoryRenameModalDialogProps = {
  currentName: string;
  onSubmit: (newName: string) => Promise<void>;
  onClose: () => void;
};

export const ConsoleStoryRenameModalDialog = ({
  currentName,
  onSubmit,
  onClose,
}: ConsoleStoryRenameModalDialogProps) => {
  const [nameInput, setNameInput] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
      aria-label="Rename story"
    >
      <button
        type="button"
        className="console-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="console-modal-inner">
        <h2 className="console-modal-title">Rename story</h2>
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
              {submitting ? 'Renaming…' : 'Rename'}
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
