import type { ConsoleToastColor } from '../../logic/actionToast';

export type ConsoleUndoToastProps = {
  message: string;
  color: ConsoleToastColor;
  remainingSeconds: number;
  progress: number;
  onUndo: () => void;
};

export const ConsoleUndoToast = ({
  message,
  color,
  remainingSeconds,
  progress,
  onUndo,
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
};

export const ConsoleErrorToast = ({
  title,
  message,
  onDismiss,
}: ConsoleErrorToastProps) => (
  <div className="console-error-toast" role="alert" aria-live="assertive">
    {title !== undefined && (
      <span className="console-error-toast-title">{title}</span>
    )}
    <span className="console-error-toast-message">{message}</span>
    <button
      type="button"
      className="console-error-toast-dismiss"
      onClick={onDismiss}
    >
      Dismiss
    </button>
  </div>
);
