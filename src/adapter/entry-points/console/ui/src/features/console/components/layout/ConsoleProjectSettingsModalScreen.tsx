export type ConsoleProjectSettingsModalScreenProps = {
  value: string;
  onChange: (v: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: (count: number) => void;
  onClose: () => void;
};

export const ConsoleProjectSettingsModalScreen = ({
  value,
  onChange,
  isLoading,
  isSaving,
  error,
  onSave,
  onClose,
}: ConsoleProjectSettingsModalScreenProps) => {
  const parsedValue = parseInt(value, 10);
  const isValid = !Number.isNaN(parsedValue) && parsedValue >= 1;

  const handleSave = () => {
    if (!isValid) {
      return;
    }
    onSave(parsedValue);
  };

  return (
    <div
      className="console-settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Project settings"
    >
      <div className="console-settings-modal-bar">
        <span className="console-settings-modal-title">Project settings</span>
        <button
          type="button"
          className="console-settings-modal-close"
          aria-label="Close project settings"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="console-settings-modal-body">
        {isLoading ? (
          <p className="console-settings-modal-loading">Loading…</p>
        ) : (
          <div className="console-settings-modal-field">
            <label
              htmlFor="max-preparing-count"
              className="console-settings-modal-label"
            >
              Maximum preparing issues count
            </label>
            <input
              id="max-preparing-count"
              type="number"
              min={1}
              step={1}
              className="console-settings-modal-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={isSaving}
              aria-label="Maximum preparing issues count"
            />
          </div>
        )}
        {error !== null && (
          <p className="console-settings-modal-error" role="alert">
            {error}
          </p>
        )}
        {!isLoading && (
          <div className="console-settings-modal-actions">
            <button
              type="button"
              className="console-settings-modal-save"
              onClick={handleSave}
              disabled={!isValid || isSaving}
              aria-label="Save settings"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
