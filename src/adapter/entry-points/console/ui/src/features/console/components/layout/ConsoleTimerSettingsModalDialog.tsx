export type ConsoleTimerSettingsModalDialogProps = {
  isOpen: boolean;
  timerMode: boolean;
  projectMinutes: Record<string, number>;
  pjcodes: string[];
  isLoadingPjcodes: boolean;
  onOpen: () => void;
  onToggleTimerMode: (enabled: boolean) => void;
  onChangeMinutes: (pjcode: string, minutes: number) => void;
  onSave: () => void;
  onClose: () => void;
};

export const ConsoleTimerSettingsModalDialog = ({
  isOpen,
  timerMode,
  projectMinutes,
  pjcodes,
  isLoadingPjcodes,
  onOpen,
  onToggleTimerMode,
  onChangeMinutes,
  onSave,
  onClose,
}: ConsoleTimerSettingsModalDialogProps) => {
  return (
    <>
      <button
        type="button"
        className="console-timer-settings-button"
        aria-label="Console Settings"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={onOpen}
      >
        ⚙
      </button>
      {isOpen && (
        <div
          className="console-timer-settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Console Settings"
        >
          <button
            type="button"
            className="console-timer-settings-backdrop"
            aria-label="Close settings"
            onClick={onClose}
          />
          <div className="console-timer-settings-dialog-inner">
            <h2 className="console-timer-settings-title">Console Settings</h2>
            <div className="console-timer-settings-row">
              <label
                className="console-timer-settings-label"
                htmlFor="timer-mode-toggle"
              >
                Timer Mode
              </label>
              <input
                id="timer-mode-toggle"
                type="checkbox"
                checked={timerMode}
                onChange={(e) => onToggleTimerMode(e.target.checked)}
              />
            </div>
            {isLoadingPjcodes ? (
              <div className="console-timer-settings-loading">
                Loading projects...
              </div>
            ) : (
              <ul className="console-timer-settings-project-list">
                {pjcodes.map((pjcode) => (
                  <li
                    key={pjcode}
                    className="console-timer-settings-project-row"
                  >
                    <label
                      htmlFor={`timer-minutes-${pjcode}`}
                      className="console-timer-settings-pjcode"
                    >
                      {pjcode}
                    </label>
                    <input
                      id={`timer-minutes-${pjcode}`}
                      type="number"
                      min={0}
                      value={projectMinutes[pjcode] ?? 0}
                      onChange={(e) =>
                        onChangeMinutes(
                          pjcode,
                          Math.max(0, parseInt(e.target.value, 10) || 0),
                        )
                      }
                      className="console-timer-settings-minutes-input"
                    />
                    <span className="console-timer-settings-minutes-label">
                      {(projectMinutes[pjcode] ?? 0) === 0 ? 'Skip' : 'min'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="console-timer-settings-actions">
              <button
                type="button"
                className="console-timer-settings-save"
                onClick={onSave}
              >
                Save and Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
