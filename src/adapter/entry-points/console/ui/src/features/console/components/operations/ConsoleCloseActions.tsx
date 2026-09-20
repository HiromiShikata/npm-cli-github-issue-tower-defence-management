import { useState } from 'react';
import type { ConsoleCloseAction } from '../../logic/operations';

export type ConsoleCloseButtonGroupProps = {
  onClose: (action: ConsoleCloseAction) => void;
  onCommentAndClose?: () => Promise<void>;
};

export const ConsoleCloseActions = ({
  onClose,
  onCommentAndClose,
}: ConsoleCloseButtonGroupProps) => {
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommentAndClose = async (): Promise<void> => {
    if (onCommentAndClose === undefined || posting) return;
    setPosting(true);
    setError(null);
    try {
      await onCommentAndClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to post');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="console-op-group">
      <button
        type="button"
        className="console-op-button"
        onClick={() => onClose('close_not_planned')}
      >
        Close as not planned
      </button>
      <button
        type="button"
        className="console-op-button"
        onClick={() => onClose('close')}
      >
        Close
      </button>
      {onCommentAndClose !== undefined && (
        <>
          <button
            type="button"
            className="console-op-button"
            disabled={posting}
            onClick={() => {
              void handleCommentAndClose();
            }}
          >
            Comment &amp; Close
          </button>
          {error !== null && (
            <span role="alert" className="console-op-comment-close-error">
              {error}
            </span>
          )}
        </>
      )}
    </div>
  );
};
