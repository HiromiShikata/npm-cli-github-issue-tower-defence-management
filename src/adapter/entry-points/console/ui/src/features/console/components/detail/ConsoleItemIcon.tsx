import {
  CONSOLE_ITEM_ICONS,
  type ConsoleItemIconInput,
  resolveConsoleItemIconKind,
} from '../../logic/itemIcons';

export type ConsoleItemIconProps = ConsoleItemIconInput & {
  size?: number;
};

export const ConsoleItemIcon = ({
  size = 12,
  ...input
}: ConsoleItemIconProps) => {
  const kind = resolveConsoleItemIconKind(input);
  const definition = CONSOLE_ITEM_ICONS[kind];
  return (
    <svg
      className="console-item-icon"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={definition.color}
      role="img"
      aria-label={kind}
    >
      {definition.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
};
