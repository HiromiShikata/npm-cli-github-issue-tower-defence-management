export type ConsoleToggleSwitchProps = {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export const ConsoleToggleSwitch = ({
  checked,
  ariaLabel,
  onChange,
  disabled = false,
}: ConsoleToggleSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`console-toggle-switch${checked ? ' console-toggle-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="console-toggle-switch-thumb" />
    </button>
  );
};
