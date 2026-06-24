import { colorFromEnum } from '../../logic/colors';
import {
  IN_TMUX_LIVE_SESSION_NAME,
  STATUS_BUTTON_NAMES,
} from '../../logic/operations';
import type { ConsoleFieldOption } from '../../logic/types';

export type ConsoleStatusButtonGroupProps = {
  statusOptions: ConsoleFieldOption[];
  onSetStatus: (option: ConsoleFieldOption) => void;
  onSetInTmuxByHuman: (option: ConsoleFieldOption) => void;
};

const findStatusOption = (
  statusOptions: ConsoleFieldOption[],
  name: string,
): ConsoleFieldOption | null => {
  const lower = name.toLowerCase();
  return (
    statusOptions.find((option) => option.name.toLowerCase() === lower) ?? null
  );
};

export const ConsoleStatusActions = ({
  statusOptions,
  onSetStatus,
  onSetInTmuxByHuman,
}: ConsoleStatusButtonGroupProps) => {
  const buttons = STATUS_BUTTON_NAMES.map((name) => ({
    name,
    option: findStatusOption(statusOptions, name),
  })).filter(
    (entry): entry is { name: string; option: ConsoleFieldOption } =>
      entry.option !== null,
  );

  if (buttons.length === 0) {
    return null;
  }

  return (
    <div className="console-op-group">
      {buttons.map(({ name, option }) => {
        const palette = colorFromEnum(option.color);
        const isInTmuxLiveSession = name === IN_TMUX_LIVE_SESSION_NAME;
        return (
          <button
            key={option.id}
            type="button"
            className="console-op-button"
            style={{
              color: palette.fg,
              borderColor: palette.border,
              backgroundColor: palette.bg,
            }}
            onClick={() =>
              isInTmuxLiveSession
                ? onSetInTmuxByHuman(option)
                : onSetStatus(option)
            }
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
};
