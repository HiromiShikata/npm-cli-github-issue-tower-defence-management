import { ConsoleClipboardCopyButton } from '../shared/ConsoleClipboardCopyButton';

export type ConsoleCopyStoryNameButtonProps = {
  storyName: string;
};

export const ConsoleCopyStoryNameButton = ({
  storyName,
}: ConsoleCopyStoryNameButtonProps) => (
  <ConsoleClipboardCopyButton
    value={storyName}
    idleText="Copy name"
    idleAriaLabel="Copy story name"
    copiedAriaLabel="Story name copied to clipboard"
    className="console-copy-story-name-button"
  />
);
