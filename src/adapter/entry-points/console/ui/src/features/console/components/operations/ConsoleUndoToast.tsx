import type { ConsoleToastColor } from '../../logic/actionToast';

export type ConsoleUndoToastProps = {
  message: string;
  color: ConsoleToastColor;
  remainingSeconds: number;
  progress: number;
  onUndo: () => void;
  onDismiss?: () => void;
};

export const ConsoleUndoToast = ({
  message,
  color,
  remainingSeconds,
  progress,
  onUndo,
  onDismiss,
}: ConsoleUndoToastProps) => (
  <div
    className={`console-undo-toast console-undo-toast-${color}`}
    role="status"
    aria-live="polite"
  >
    <span className="console-undo-toast-message">{message}</span>
    <button type="button" className="console-undo-toast-undo" onClick={onUndo}>
      Undo
    </button>
    <span className="console-undo-toast-countdown" aria-hidden="true">
      {remainingSeconds}s
    </span>
    {onDismiss !== undefined && (
      <button
        type="button"
        className="console-undo-toast-dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    )}
    <span
      className="console-undo-toast-bar"
      aria-hidden="true"
      style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
    />
  </div>
);

export type ConsoleErrorToastProps = {
  title?: string;
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
};

export const ConsoleErrorToast = ({
  title,
  message,
  onDismiss,
  onRetry,
}: ConsoleErrorToastProps) => (
  <div
    className="console-undo-toast-error console-error-toast"
    role="alert"
    aria-live="assertive"
  >
    {title !== undefined && (
      <span className="console-error-toast-title">{title}</span>
    )}
    <span className="console-error-toast-message">{message}</span>
    <div className="console-error-toast-actions">
      {onRetry !== undefined && (
        <button
          type="button"
          className="console-error-toast-retry"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
      <button
        type="button"
        className="console-error-toast-dismiss"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  </div>
);
