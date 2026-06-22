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
    role="alert"
  >
    <span className="console-undo-toast-message">{message}</span>
    <button type="button" className="console-undo-toast-undo" onClick={onUndo}>
      Undo
    </button>
    <span className="console-undo-toast-countdown">{remainingSeconds}s</span>
    <span
      className="console-undo-toast-bar"
      style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
    />
  </div>
);
