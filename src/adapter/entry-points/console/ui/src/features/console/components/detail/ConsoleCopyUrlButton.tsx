import { ConsoleClipboardCopyButton } from '../shared/ConsoleClipboardCopyButton';

export type ConsoleCopyUrlButtonProps = {
  url: string;
  label?: string;
};

export const ConsoleCopyUrlButton = ({
  url,
  label = 'Copy URL',
}: ConsoleCopyUrlButtonProps) => (
  <ConsoleClipboardCopyButton
    value={url}
    idleText="Copy URL"
    idleAriaLabel={label}
    copiedAriaLabel="URL copied to clipboard"
    className="console-copy-url-button"
  />
);
