import { useRef, useState } from 'react';
import {
  formatFullTimestamp,
  formatRelativeTime,
} from '../../logic/relativeTime';
import type { ConsoleComment } from '../../logic/types';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';

export type ConsoleCommentComposerProps = {
  initiallyOpen: boolean;
  now: number;
  onSubmit: (body: string) => Promise<ConsoleComment>;
  onUploadFile?: (file: File) => Promise<string>;
};

type ComposerStatus =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'error'; message: string };

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'error'; message: string };

export const appendAttachmentMarkdown = (
  draft: string,
  markdown: string,
): string => {
  if (draft.length === 0) {
    return `${markdown}\n`;
  }
  if (draft.endsWith('\n')) {
    return `${draft}${markdown}\n`;
  }
  return `${draft}\n${markdown}\n`;
};

export const ConsoleCommentComposer = ({
  initiallyOpen,
  now,
  onSubmit,
  onUploadFile,
}: ConsoleCommentComposerProps) => {
  const [open, setOpen] = useState<boolean>(initiallyOpen);
  const [draft, setDraft] = useState<string>('');
  const [status, setStatus] = useState<ComposerStatus>({ kind: 'idle' });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    kind: 'idle',
  });
  const [posted, setPosted] = useState<ConsoleComment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const uploadFiles = async (files: File[]): Promise<void> => {
    if (onUploadFile === undefined || files.length === 0) {
      return;
    }
    for (const file of files) {
      setUploadStatus({ kind: 'uploading', fileName: file.name });
      try {
        const markdown = await onUploadFile(file);
        setDraft((previous) => appendAttachmentMarkdown(previous, markdown));
        setUploadStatus({ kind: 'idle' });
      } catch (error) {
        setUploadStatus({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'failed to upload file',
        });
        return;
      }
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
        {open ? '✕ Close' : '💬 Add a comment'}
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
            onDragOver={(event) => {
              if (onUploadFile === undefined) {
                return;
              }
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (onUploadFile === undefined) {
                return;
              }
              event.preventDefault();
              void uploadFiles(Array.from(event.dataTransfer.files));
            }}
            onPaste={(event) => {
              if (onUploadFile === undefined) {
                return;
              }
              const files = Array.from(event.clipboardData.files);
              if (files.length === 0) {
                return;
              }
              event.preventDefault();
              void uploadFiles(files);
            }}
          />
          {onUploadFile !== undefined && (
            <div className="console-composer-attach">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="console-composer-file-input"
                aria-label="Attach files"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  void uploadFiles(files);
                }}
              />
              <button
                type="button"
                className="console-composer-attach-button"
                disabled={uploadStatus.kind === 'uploading'}
                onClick={() => fileInputRef.current?.click()}
              >
                📎 Attach files
              </button>
              {uploadStatus.kind === 'uploading' && (
                <span className="console-composer-status">
                  Uploading {uploadStatus.fileName}…
                </span>
              )}
              {uploadStatus.kind === 'error' && (
                <span
                  role="alert"
                  className="console-composer-status console-composer-error"
                >
                  Upload failed: {uploadStatus.message}
                </span>
              )}
            </div>
          )}
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
