import { CONSOLE_COLOR_PALETTE } from '../../logic/colors';
import type { ConsoleColor } from '../../logic/types';

const ALL_COLORS = Object.keys(CONSOLE_COLOR_PALETTE) as ConsoleColor[];

export type ConsoleStoryColorSelectModalDialogProps = {
  storyName: string;
  storyOptionId: string;
  onSelectColor: (storyOptionId: string, color: ConsoleColor) => void;
  onClose: () => void;
  disabled: boolean;
};

export const ConsoleStoryColorSelectModalDialog = ({
  storyName,
  storyOptionId,
  onSelectColor,
  onClose,
  disabled,
}: ConsoleStoryColorSelectModalDialogProps) => {
  const handleSwatchClick = (color: ConsoleColor): void => {
    onSelectColor(storyOptionId, color);
    onClose();
  };

  return (
    <div
      className="console-modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`Change color for ${storyName}`}
    >
      <button
        type="button"
        className="console-modal-backdrop"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="console-modal-inner">
        <h2 className="console-modal-title">Change color for {storyName}</h2>
        <div className="console-story-color-palette">
          {ALL_COLORS.map((color) => {
            const palette = CONSOLE_COLOR_PALETTE[color];
            return (
              <button
                key={color}
                type="button"
                className="console-story-color-swatch"
                aria-label={color === 'GRAY' ? `${color} (disable)` : color}
                style={{ backgroundColor: palette.dot }}
                onClick={() => handleSwatchClick(color)}
                disabled={disabled}
              >
                {color === 'GRAY' && (
                  <span className="console-story-color-swatch-label">
                    disable
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="console-modal-actions">
          <button type="button" className="console-op-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
