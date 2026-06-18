import type { CSSProperties } from 'react';
import { colorFromEnum } from '../colors';
import type { ConsoleFieldOption } from '../types';

const STATUS_BUTTON_ORDER = [
  'In Tmux by agent',
  'In Tmux by human',
  'Todo by human',
  'Awaiting Workspace',
] as const;

const INTMUX_STATUS_NAME = 'In Tmux by human';

const findStatusOption = (
  options: ConsoleFieldOption[],
  name: string,
): ConsoleFieldOption | null => {
  const target = name.toLowerCase().trim();
  return (
    options.find((option) => option.name.toLowerCase().trim() === target) ??
    null
  );
};

const statusButtonStyle = (option: ConsoleFieldOption): CSSProperties => {
  const palette = colorFromEnum(option.color);
  return {
    backgroundColor: palette.bg,
    borderColor: palette.border,
    color: palette.fg,
  };
};

export type ConsoleStatusButtonGroupProps = {
  statusOptions: ConsoleFieldOption[];
  onSetStatus: (option: ConsoleFieldOption) => void;
  onSetInTmux: (option: ConsoleFieldOption) => void;
};

export const ConsoleStatusButtonGroup = ({
  statusOptions,
  onSetStatus,
  onSetInTmux,
}: ConsoleStatusButtonGroupProps) => {
  const orderedButtons = STATUS_BUTTON_ORDER.map((name) =>
    findStatusOption(statusOptions, name),
  ).filter((option): option is ConsoleFieldOption => option !== null);

  if (orderedButtons.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {orderedButtons.map((option) => {
        const isInTmux = option.name === INTMUX_STATUS_NAME;
        return (
          <button
            key={option.id}
            type="button"
            style={statusButtonStyle(option)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
            onClick={() =>
              isInTmux ? onSetInTmux(option) : onSetStatus(option)
            }
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
};
