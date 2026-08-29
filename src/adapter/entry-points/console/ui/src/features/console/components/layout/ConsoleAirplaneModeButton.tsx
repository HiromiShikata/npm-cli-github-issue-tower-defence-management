import type {
  AirplaneModeStatus,
  AirplaneSyncProgress,
} from '../../hooks/useAirplaneMode';

export type ConsoleAirplaneModeButtonProps = {
  status: AirplaneModeStatus;
  progress: AirplaneSyncProgress | null;
  capturedAt: string | null;
  failures: string[];
  onStartSync: () => void;
  onTurnOff: () => void;
};

const progressLabel = (progress: AirplaneSyncProgress | null): string => {
  if (progress === null || progress.total === 0) {
    return 'Syncing…';
  }
  return `Syncing ${progress.fetched}/${progress.total}`;
};

export const ConsoleAirplaneModeButton = ({
  status,
  progress,
  capturedAt,
  failures,
  onStartSync,
  onTurnOff,
}: ConsoleAirplaneModeButtonProps) => {
  if (status === 'on') {
    return (
      <div className="console-airplane-mode console-airplane-mode--on">
        <span className="console-airplane-mode-label">
          ✈ Airplane mode
          {capturedAt !== null
            ? `: ${new Date(capturedAt).toLocaleString()}`
            : ''}
        </span>
        <button
          type="button"
          className="console-airplane-mode-toggle"
          onClick={onTurnOff}
        >
          Turn off
        </button>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="console-airplane-mode console-airplane-mode--syncing">
        <span
          className="console-airplane-mode-progress"
          role="status"
          aria-live="polite"
        >
          {progressLabel(progress)}
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="console-airplane-mode console-airplane-mode--error">
        <span className="console-airplane-mode-error-label" role="alert">
          Sync failed{failures.length > 0 ? `: ${failures.length} item(s)` : ''}
        </span>
        <button
          type="button"
          className="console-airplane-mode-toggle"
          onClick={onStartSync}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="console-airplane-mode console-airplane-mode--off">
      <button
        type="button"
        className="console-airplane-mode-toggle"
        onClick={onStartSync}
      >
        ✈ Airplane mode
      </button>
    </div>
  );
};
