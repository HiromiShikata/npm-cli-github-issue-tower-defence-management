import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConsoleToggleSwitch } from '../shared/ConsoleToggleSwitch';

export type ConsoleTimerSettingsModalDialogProps = {
  isOpen: boolean;
  isTimerActive: boolean;
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
  isTimerActive,
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dialogPos, setDialogPos] = useState<{
    top: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const rawRight = viewportWidth - rect.right;
      const dialogMinWidth = 280;
      const margin = 8;
      setDialogPos({
        top: rect.bottom + 4,
        right: Math.max(
          margin,
          Math.min(rawRight, viewportWidth - dialogMinWidth - margin),
        ),
      });
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`console-timer-settings-button${isTimerActive ? ' console-timer-settings-button--active' : ''}`}
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={onOpen}
      >
        ⏱
      </button>
      {isOpen &&
        createPortal(
          <div className="console-timer-settings-overlay">
            <button
              type="button"
              className="console-timer-settings-backdrop"
              aria-label="Close settings"
              onClick={onClose}
            />
            <div
              className="console-timer-settings-dialog-inner"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
              style={
                dialogPos !== null
                  ? {
                      position: 'fixed',
                      top: dialogPos.top,
                      right: dialogPos.right,
                    }
                  : undefined
              }
            >
              <h2 className="console-timer-settings-title">Settings</h2>
              {isLoadingPjcodes ? (
                <div className="console-timer-settings-loading">
                  Loading projects...
                </div>
              ) : (
                <table className="console-timer-settings-project-table">
                  <thead>
                    <tr>
                      <th className="console-timer-settings-th">Project</th>
                      <th className="console-timer-settings-th console-timer-settings-th-minutes">
                        Min
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pjcodes.map((pjcode) => (
                      <tr
                        key={pjcode}
                        className="console-timer-settings-project-row"
                      >
                        <td>
                          <label
                            htmlFor={`timer-minutes-${pjcode}`}
                            className="console-timer-settings-pjcode"
                          >
                            {pjcode}
                          </label>
                        </td>
                        <td className="console-timer-settings-minutes-cell">
                          <div className="console-timer-settings-minutes-stepper">
                            <button
                              type="button"
                              className="console-timer-settings-minutes-step-btn"
                              aria-label={`Decrease minutes for ${pjcode}`}
                              onClick={() =>
                                onChangeMinutes(
                                  pjcode,
                                  Math.max(0, (projectMinutes[pjcode] ?? 0) - 1),
                                )
                              }
                            >
                              −
                            </button>
                            <input
                              id={`timer-minutes-${pjcode}`}
                              type="number"
                              min={0}
                              max={999}
                              value={
                                (projectMinutes[pjcode] ?? 0) === 0
                                  ? ''
                                  : projectMinutes[pjcode]
                              }
                              onChange={(e) =>
                                onChangeMinutes(
                                  pjcode,
                                  Math.max(
                                    0,
                                    parseInt(e.target.value, 10) || 0,
                                  ),
                                )
                              }
                              className="console-timer-settings-minutes-input"
                            />
                            <button
                              type="button"
                              className="console-timer-settings-minutes-step-btn"
                              aria-label={`Increase minutes for ${pjcode}`}
                              onClick={() =>
                                onChangeMinutes(
                                  pjcode,
                                  Math.min(999, (projectMinutes[pjcode] ?? 0) + 1),
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                          <span className="console-timer-settings-minutes-label">
                            {(projectMinutes[pjcode] ?? 0) === 0
                              ? 'Skip'
                              : 'min'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="console-timer-settings-row">
                <span className="console-timer-settings-label">Timer Mode</span>
                <ConsoleToggleSwitch
                  checked={timerMode}
                  ariaLabel="Timer Mode"
                  onChange={onToggleTimerMode}
                />
              </div>
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
          </div>,
          document.body,
        )}
    </>
  );
};
