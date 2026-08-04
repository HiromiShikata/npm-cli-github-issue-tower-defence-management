import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '../../logic/clipboard';

export type ConsoleClipboardCopyButtonProps = {
  value: string;
  idleText: string;
  idleAriaLabel: string;
  copiedAriaLabel: string;
  className: string;
};

type ConsoleClipboardCopyState = 'idle' | 'copied' | 'failed';

const COPIED_FEEDBACK_MS = 1500;
const FAILED_TEXT = 'Copy failed';
const FAILED_ARIA_LABEL = 'Copying to the clipboard failed';

export const ConsoleClipboardCopyButton = ({
  value,
  idleText,
  idleAriaLabel,
  copiedAriaLabel,
  className,
}: ConsoleClipboardCopyButtonProps) => {
  const [copyState, setCopyState] = useState<ConsoleClipboardCopyState>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(value);
      setCopyState('copied');
    } catch (error) {
      console.error(error);
      setCopyState('failed');
    }
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, COPIED_FEEDBACK_MS);
  };

  const buttonText =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'failed'
        ? FAILED_TEXT
        : idleText;
  const buttonAriaLabel =
    copyState === 'copied'
      ? copiedAriaLabel
      : copyState === 'failed'
        ? FAILED_ARIA_LABEL
        : idleAriaLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={buttonAriaLabel}
      onClick={handleCopy}
    >
      {buttonText}
    </Button>
  );
};
