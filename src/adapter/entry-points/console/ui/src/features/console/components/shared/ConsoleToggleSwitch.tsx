export type ConsoleToggleSwitchProps = {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
};

export const ConsoleToggleSwitch = ({
  checked,
  ariaLabel,
  onChange,
}: ConsoleToggleSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`console-toggle-switch${checked ? ' console-toggle-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="console-toggle-switch-thumb" />
    </button>
  );
};
