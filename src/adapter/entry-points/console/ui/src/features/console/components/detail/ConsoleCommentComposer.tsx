import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ATTACHMENT_UPLOAD_BROWSER_ABORT_MS } from '../../lib/consoleApi';
import { resolveListContinuationOnKeyDown } from '../../lib/listContinuation';
import type { ConsoleComment } from '../../logic/types';

export type ConsoleCommentSubmitResult = ConsoleComment | 'held_offline';

export type ConsoleCommentComposerProps = {
  initiallyOpen: boolean;
  initialDraft?: string;
  onSubmit: (body: string) => Promise<ConsoleCommentSubmitResult>;
  onDraftChange?: (draft: string) => void;
  onSubmitAndMoveToAwaitingWorkspace?: (
    body: string,
  ) => Promise<ConsoleCommentSubmitResult>;
  onOkAndAwaitingWorkspace?: () => void;
  onUploadFile?: (files: File | File[]) => Promise<string>;
  onOpenChange?: (open: boolean) => void;
};

type ComposerStatus =
  { kind: 'idle' } | { kind: 'posting' } | { kind: 'error'; message: string };

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
  return `${prefix}${draft.includes(placeholder) ? '' : '\n\n\n'}${placeholder}\n`;
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
  onSubmitAndMoveToAwaitingWorkspace,
  onOkAndAwaitingWorkspace,
  onUploadFile,
  onOpenChange,
}: ConsoleCommentComposerProps) => {
  const [open, setOpen] = useState<boolean>(initiallyOpen);
  const initialDraftValue = initialDraft ?? '';
  const initialDisplayDraft = initialDraftValue;
  const [draft, setDraft] = useState<string>(initialDisplayDraft);
  const draftRef = useRef<string>(initialDisplayDraft);
  const isMountedRef = useRef(true);
  draftRef.current = draft;
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (initialDraftValue !== draftRef.current) {
      const nextDraft = initialDraftValue;
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }
  }, [initialDraftValue]);
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const [status, setStatus] = useState<ComposerStatus>({ kind: 'idle' });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    kind: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorToRestoreRef = useRef<{ start: number; end: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (cursorToRestoreRef.current !== null && textareaRef.current !== null) {
      textareaRef.current.setSelectionRange(
        cursorToRestoreRef.current.start,
        cursorToRestoreRef.current.end,
      );
      cursorToRestoreRef.current = null;
    }
  });

  const saveCursorPosition = (): void => {
    if (textareaRef.current !== null) {
      cursorToRestoreRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  const submit = async (action: 'comment' | 'move'): Promise<void> => {
    const body = draft.trim();
    if (
      body.length === 0 ||
      status.kind === 'posting' ||
      uploadStatus.kind === 'uploading'
    ) {
      return;
    }
    setStatus({ kind: 'posting' });
    try {
      if (
        action === 'move' &&
        onSubmitAndMoveToAwaitingWorkspace !== undefined
      ) {
        await onSubmitAndMoveToAwaitingWorkspace(body);
      } else {
        await onSubmit(body);
      }
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
    let draftWithPlaceholders = draftRef.current;
    for (const file of files) {
      saveCursorPosition();
      draftWithPlaceholders = insertUploadPlaceholder(
        draftWithPlaceholders,
        file.name,
      );
    }
    draftRef.current = draftWithPlaceholders;
    setDraft(draftWithPlaceholders);
    setUploadStatus({
      kind: 'uploading',
      fileName: files.map((file) => file.name).join(', '),
    });
    try {
      const rawResult = await Promise.race([
        onUploadFile(files.length === 1 ? files[0] : files),
        new Promise<string>((_, reject) =>
          globalThis.setTimeout(
            () => reject(new Error('upload timed out')),
            ATTACHMENT_UPLOAD_BROWSER_ABORT_MS,
          ),
        ),
      ]);
      let results: {
        fileName: string;
        status: 'uploaded' | 'failed';
        markdown?: string;
        error?: string;
      }[];
      try {
        const parsed: unknown = JSON.parse(rawResult);
        results = Array.isArray(parsed) ? parsed : [];
      } catch {
        results = files.map((file) => ({
          fileName: file.name,
          status: 'uploaded',
          markdown: rawResult,
        }));
      }
      let firstError: string | null = null;
      files.forEach((file, index) => {
        const result = results[index];
        saveCursorPosition();
        if (
          result?.status === 'uploaded' &&
          typeof result.markdown === 'string'
        ) {
          const nextDraft = replacePlaceholderWithMarkdown(
            draftRef.current,
            file.name,
            result.markdown as string,
          );
          draftRef.current = nextDraft;
          setDraft(nextDraft);
          if (isMountedRef.current) {
            onDraftChange?.(nextDraft);
          }
        } else {
          const error = result?.error ?? 'failed to upload file';
          firstError ??= error;
          const nextDraft = removePlaceholder(draftRef.current, file.name);
          draftRef.current = nextDraft;
          setDraft(nextDraft);
          if (isMountedRef.current) {
            onDraftChange?.(nextDraft);
          }
        }
      });
      setUploadStatus(
        firstError === null
          ? { kind: 'idle' }
          : { kind: 'error', message: firstError },
      );
    } catch (error) {
      saveCursorPosition();
      for (const file of files) {
        setDraft((previous) => removePlaceholder(previous, file.name));
      }
      setUploadStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'failed to upload file',
      });
    }
  };

  const isDraftEmpty = draft.trim().length === 0;

  return (
    <div className="console-composer">
      <button
        type="button"
        className="console-composer-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            onOpenChange?.(next);
            return next;
          });
        }}
      >
        {open ? '✕ Close' : '💬 Add a comment'}
      </button>
      {open && (
        <div className="console-composer-form">
          <textarea
            ref={textareaRef}
            className="console-composer-input"
            rows={3}
            placeholder="Leave a comment…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              const textarea = event.currentTarget;
              const outcome = resolveListContinuationOnKeyDown(
                {
                  key: event.key,
                  isComposing: event.nativeEvent.isComposing,
                  keyCode: event.keyCode,
                  which: event.which,
                },
                textarea.value,
                textarea.selectionStart,
                textarea.selectionEnd,
              );
              if (!outcome.shouldApply) {
                return;
              }
              event.preventDefault();
              cursorToRestoreRef.current = {
                start: outcome.cursorPosition,
                end: outcome.cursorPosition,
              };
              setDraft(outcome.value);
            }}
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
              disabled={
                status.kind === 'posting' ||
                isDraftEmpty ||
                uploadStatus.kind === 'uploading'
              }
              onClick={() => {
                void submit('comment');
              }}
            >
              Comment
            </button>
            {onOkAndAwaitingWorkspace !== undefined && (
              <button
                type="button"
                className="console-composer-submit"
                disabled={status.kind === 'posting'}
                onClick={onOkAndAwaitingWorkspace}
              >
                ok &amp; Awaiting Workspace
              </button>
            )}
            {onSubmitAndMoveToAwaitingWorkspace !== undefined && (
              <button
                type="button"
                className="console-composer-submit"
                disabled={
                  status.kind === 'posting' ||
                  isDraftEmpty ||
                  uploadStatus.kind === 'uploading'
                }
                onClick={() => {
                  void submit('move');
                }}
              >
                Comment & Awaiting Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
