import { useState } from 'react';
import {
  formatFullTimestamp,
  formatRelativeTime,
} from '../../logic/relativeTime';
import type { ConsoleComment } from '../../logic/types';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';

export type ConsoleCommentComposerProps = {
  isPr: boolean;
  now: number;
  onSubmit: (body: string) => Promise<ConsoleComment>;
};

type ComposerStatus =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'error'; message: string };

export const ConsoleCommentComposer = ({
  isPr,
  now,
  onSubmit,
}: ConsoleCommentComposerProps) => {
  const [open, setOpen] = useState<boolean>(!isPr);
  const [draft, setDraft] = useState<string>('');
  const [status, setStatus] = useState<ComposerStatus>({ kind: 'idle' });
  const [posted, setPosted] = useState<ConsoleComment[]>([]);

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (body.length === 0 || status.kind === 'posting') {
      return;
    }
    setStatus({ kind: 'posting' });
    try {
      const comment = await onSubmit(body);
      setPosted((previous) => [...previous, comment]);
      setDraft('');
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'failed to post',
      });
    }
  };

  return (
    <div className="console-composer">
      <button
        type="button"
        className="console-composer-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '✕ Cancel' : '💬 Add a comment'}
      </button>
      {posted.length > 0 && (
        <div className="console-composer-posted">
          {posted.map((comment) => (
            <article
              key={`${comment.author}:${comment.createdAt}:${comment.body}`}
              className="console-comment"
            >
              <header
                className="console-comment-header"
                title={formatFullTimestamp(comment.createdAt)}
              >
                <span className="console-comment-author">
                  {comment.author === '' ? 'you' : comment.author}
                </span>
                <span className="console-comment-time">
                  {formatRelativeTime(comment.createdAt, now)}
                </span>
              </header>
              <ConsoleMarkdownContent body={comment.body} />
            </article>
          ))}
        </div>
      )}
      {open && (
        <div className="console-composer-form">
          <textarea
            className="console-composer-input"
            rows={3}
            placeholder="Leave a comment…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="console-composer-row">
            {status.kind === 'posting' && (
              <span className="console-composer-status">Posting…</span>
            )}
            {status.kind === 'error' && (
              <span
                role="alert"
                className="console-composer-status console-composer-error"
              >
                Failed: {status.message}
              </span>
            )}
            <button
              type="button"
              className="console-composer-submit"
              disabled={status.kind === 'posting'}
              onClick={() => {
                void submit();
              }}
            >
              Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
