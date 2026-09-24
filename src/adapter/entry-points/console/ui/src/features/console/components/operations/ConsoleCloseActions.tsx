import { useState } from 'react';
import type { ConsoleCloseAction } from '../../logic/operations';

export type ConsoleCloseButtonGroupProps = {
  onClose: (action: ConsoleCloseAction) => void;
  onCommentAndClose?: () => Promise<void>;
  onOkAndClose?: () => Promise<void>;
  isDraftEmpty?: boolean;
};

export const ConsoleCloseActions = ({
  onClose,
  onCommentAndClose,
  onOkAndClose,
  isDraftEmpty,
}: ConsoleCloseButtonGroupProps) => {
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsyncClose = async (fn: (() => Promise<void>) | undefined): Promise<void> => {
    if (fn === undefined || posting) return;
    setPosting(true);
    setError(null);
    try {
      await fn();
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
      {onOkAndClose !== undefined && (
        <button
          type="button"
          className="console-op-button"
          disabled={posting}
          onClick={() => {
            void handleAsyncClose(onOkAndClose);
          }}
        >
          OK &amp; Close
        </button>
      )}
      {onCommentAndClose !== undefined && (
        <button
          type="button"
          className="console-op-button"
          disabled={posting || isDraftEmpty === true}
          onClick={() => {
            void handleAsyncClose(onCommentAndClose);
          }}
        >
          Comment &amp; Close
        </button>
      )}
      {error !== null && (
        <span role="alert" className="console-op-comment-close-error">
          {error}
        </span>
      )}
    </div>
  );
};
