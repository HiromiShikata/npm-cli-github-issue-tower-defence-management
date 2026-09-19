import { useState } from 'react';
import type { ConsoleCloseAction } from '../../logic/operations';

export type ConsoleCloseButtonGroupProps = {
  onClose: (action: ConsoleCloseAction) => void;
  onCommentAndClose?: (body: string) => Promise<void>;
};

export const ConsoleCloseActions = ({
  onClose,
  onCommentAndClose,
}: ConsoleCloseButtonGroupProps) => {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommentAndClose = async (): Promise<void> => {
    const body = draft.trim();
    if (!body || posting || onCommentAndClose === undefined) return;
    setPosting(true);
    setError(null);
    try {
      await onCommentAndClose(body);
      setDraft('');
      setExpanded(false);
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
            onClick={() => setExpanded((v) => !v)}
          >
            Comment &amp; Close
          </button>
          {expanded && (
            <div className="console-op-comment-and-close">
              <textarea
                className="console-op-comment-and-close-input"
                placeholder="Leave a comment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              {error !== null && (
                <span
                  role="alert"
                  className="console-op-comment-and-close-error"
                >
                  {error}
                </span>
              )}
              <button
                type="button"
                className="console-op-button"
                disabled={posting || draft.trim().length === 0}
                onClick={() => {
                  void handleCommentAndClose();
                }}
              >
                Submit
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
