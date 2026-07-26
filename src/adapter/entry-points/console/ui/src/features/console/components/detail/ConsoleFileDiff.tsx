import { Fragment, useState } from 'react';
import type { ConsoleReviewCommentSide } from '../../lib/consoleApi';
import { type ConsoleDiffLine, parseUnifiedDiff } from '../../logic/diff';

export type ConsoleInlineCommentTarget = {
  path: string;
  line: number;
  side: ConsoleReviewCommentSide;
};

export type ConsoleAddInlineComment = (
  path: string,
  line: number,
  side: ConsoleReviewCommentSide,
  body: string,
) => Promise<void>;

export type ConsoleFileDiffProps = {
  patch: string | null;
  path?: string;
  onAddInlineComment?: ConsoleAddInlineComment;
};

type ComposerStatus =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'error'; message: string }
  | { kind: 'posted' };

const commentTargetForRow = (
  row: ConsoleDiffLine,
): { line: number; side: ConsoleReviewCommentSide } | null => {
  if (row.kind === 'add' || row.kind === 'ctx') {
    if (row.newLineNumber === null) {
      return null;
    }
    return { line: row.newLineNumber, side: 'RIGHT' };
  }
  if (row.kind === 'del') {
    if (row.oldLineNumber === null) {
      return null;
    }
    return { line: row.oldLineNumber, side: 'LEFT' };
  }
  return null;
};

const rowKey = (row: ConsoleDiffLine): string =>
  `${row.kind}:${row.oldLineNumber ?? 'x'}:${row.newLineNumber ?? 'x'}:${row.content}`;

type ConsoleInlineCommentComposerProps = {
  target: ConsoleInlineCommentTarget;
  onSubmit: ConsoleAddInlineComment;
  onClose: () => void;
};

const ConsoleInlineCommentComposer = ({
  target,
  onSubmit,
  onClose,
}: ConsoleInlineCommentComposerProps) => {
  const [draft, setDraft] = useState<string>('');
  const [status, setStatus] = useState<ComposerStatus>({ kind: 'idle' });

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (body.length === 0 || status.kind === 'posting') {
      return;
    }
    setStatus({ kind: 'posting' });
    try {
      await onSubmit(target.path, target.line, target.side, body);
      setDraft('');
      setStatus({ kind: 'posted' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'failed to post',
      });
    }
  };

  return (
    <div className="console-diff-composer">
      <div className="console-diff-composer-anchor">
        commenting on line {target.line} ({target.side})
      </div>
      {status.kind === 'posted' ? (
        <p className="console-diff-composer-posted">Comment saved.</p>
      ) : (
        <>
          <textarea
            className="console-diff-composer-input"
            rows={3}
            placeholder="Leave a review comment on this line…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="console-diff-composer-controls">
            <button
              type="button"
              className="console-diff-composer-submit"
              disabled={status.kind === 'posting'}
              onClick={() => {
                void submit();
              }}
            >
              Comment
            </button>
            <button
              type="button"
              className="console-diff-composer-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            {status.kind === 'posting' && (
              <span className="console-diff-composer-status">Posting…</span>
            )}
            {status.kind === 'error' && (
              <span
                role="alert"
                className="console-diff-composer-status console-diff-composer-error"
              >
                Failed: {status.message}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const ConsoleFileDiff = ({
  patch,
  path,
  onAddInlineComment,
}: ConsoleFileDiffProps) => {
  const [activeTarget, setActiveTarget] =
    useState<ConsoleInlineCommentTarget | null>(null);

  if (patch === null || patch === '') {
    return (
      <p className="console-file-diff-empty">(no diff / binary or too large)</p>
    );
  }
  const rows = parseUnifiedDiff(patch);
  const canComment =
    onAddInlineComment !== undefined && path !== undefined && path.length > 0;
  const columnCount = canComment ? 4 : 3;

  return (
    <table className="console-file-diff">
      <tbody>
        {rows.map((row) => {
          const key = rowKey(row);
          const target = canComment ? commentTargetForRow(row) : null;
          const isActive =
            activeTarget !== null &&
            target !== null &&
            activeTarget.line === target.line &&
            activeTarget.side === target.side;
          return (
            <Fragment key={key}>
              <tr className={`console-diff-row console-diff-${row.kind}`}>
                {canComment && (
                  <td className="console-diff-comment-cell">
                    {target !== null && path !== undefined && (
                      <button
                        type="button"
                        className="console-diff-comment-button"
                        aria-label={`Comment on line ${target.line} (${target.side})`}
                        aria-expanded={isActive}
                        onClick={() =>
                          setActiveTarget(
                            isActive
                              ? null
                              : {
                                  path,
                                  line: target.line,
                                  side: target.side,
                                },
                          )
                        }
                      >
                        +
                      </button>
                    )}
                  </td>
                )}
                <td className="console-diff-ln">{row.oldLineNumber ?? ''}</td>
                <td className="console-diff-ln">{row.newLineNumber ?? ''}</td>
                <td className="console-diff-code">{row.content}</td>
              </tr>
              {isActive &&
                onAddInlineComment !== undefined &&
                activeTarget !== null && (
                  <tr className="console-diff-composer-row">
                    <td colSpan={columnCount}>
                      <ConsoleInlineCommentComposer
                        target={activeTarget}
                        onSubmit={onAddInlineComment}
                        onClose={() => setActiveTarget(null)}
                      />
                    </td>
                  </tr>
                )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
};
