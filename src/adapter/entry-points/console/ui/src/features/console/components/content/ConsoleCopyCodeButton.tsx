import { ConsoleClipboardCopyButton } from '../shared/ConsoleClipboardCopyButton';

export type ConsoleCopyCodeButtonProps = {
  code: string;
  label?: string;
};

export const ConsoleCopyCodeButton = ({
  code,
  label = 'Copy code',
}: ConsoleCopyCodeButtonProps) => (
  <ConsoleClipboardCopyButton
    value={code}
    idleText={label}
    idleAriaLabel={label}
    copiedAriaLabel="Code copied to clipboard"
    className="console-copy-code-button"
  />
);
