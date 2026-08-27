import { useEffect, useRef, useState } from 'react';
import type { ConsoleComment } from '../../logic/types';

export type ConsoleCommentComposerProps = {
  initiallyOpen: boolean;
  initialDraft?: string;
  onSubmit: (body: string) => Promise<ConsoleComment>;
  onDraftChange?: (draft: string) => void;
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

export const insertUploadPlaceholder = (
  draft: string,
  fileName: string,
): string => {
  const placeholder = `![uploading ${fileName}]()`;
  const prefix = draft.length === 0 ? '' : draft.replace(/\n*$/, '\n');
  return `${prefix}\n\n\n${placeholder}\n`;
};

export const replacePlaceholderWithMarkdown = (
  draft: string,
  fileName: string,
  markdown: string,
): string => {
  const placeholder = `![uploading ${fileName}]()`;
  const index = draft.indexOf(placeholder);
  if (index === -1) {
    return appendAttachmentMarkdown(draft, markdown);
  }
  return (
    draft.slice(0, index) + markdown + draft.slice(index + placeholder.length)
  );
};

export const removePlaceholder = (draft: string, fileName: string): string => {
  const placeholder = `![uploading ${fileName}]()`;
  const index = draft.indexOf(placeholder);
  if (index === -1) {
    return draft;
  }
  let start = index;
  let newlinesRemoved = 0;
  while (newlinesRemoved < 3 && start > 0 && draft[start - 1] === '\n') {
    start--;
    newlinesRemoved++;
  }
  const trailingNewline = draft[index + placeholder.length] === '\n' ? 1 : 0;
  const end = index + placeholder.length + trailingNewline;
  return draft.slice(0, start) + draft.slice(end);
};

export const ConsoleCommentComposer = ({
  initiallyOpen,
  initialDraft,
  onSubmit,
  onDraftChange,
  onUploadFile,
}: ConsoleCommentComposerProps) => {
  const [open, setOpen] = useState<boolean>(initiallyOpen);
  const [draft, setDraft] = useState<string>(initialDraft ?? '');
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const [status, setStatus] = useState<ComposerStatus>({ kind: 'idle' });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    kind: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (body.length === 0 || status.kind === 'posting') {
      return;
    }
    setStatus({ kind: 'posting' });
    try {
      await onSubmit(body);
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
      setDraft((previous) => insertUploadPlaceholder(previous, file.name));
      setUploadStatus({ kind: 'uploading', fileName: file.name });
      try {
        const markdown = await onUploadFile(file);
        setDraft((previous) =>
          replacePlaceholderWithMarkdown(previous, file.name, markdown),
        );
        setUploadStatus({ kind: 'idle' });
      } catch (error) {
        setDraft((previous) => removePlaceholder(previous, file.name));
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
