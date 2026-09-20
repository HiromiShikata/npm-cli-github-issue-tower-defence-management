import { useEffect, useRef, useState } from 'react';

export type ConsoleStoryDescriptionModalDialogProps = {
  currentDescription: string;
  onSubmit: (newDescription: string) => Promise<void>;
  onClose: () => void;
};

export const ConsoleStoryDescriptionModalDialog = ({
  currentDescription,
  onSubmit,
  onClose,
}: ConsoleStoryDescriptionModalDialogProps) => {
  const [descriptionInput, setDescriptionInput] = useState(currentDescription);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(descriptionInput.trim());
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
      aria-label="Edit story description"
    >
      <button
        type="button"
        className="console-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="console-modal-inner">
        <h2 className="console-modal-title">Edit story description</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <textarea
            ref={textareaRef}
            className="console-modal-input"
            placeholder="Story description"
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            disabled={submitting}
            rows={4}
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
              {submitting ? 'Saving…' : 'Save'}
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
