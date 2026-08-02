import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export type ConsoleClipboardCopyButtonProps = {
  value: string;
  idleText: string;
  idleAriaLabel: string;
  copiedAriaLabel: string;
  className: string;
};

const COPIED_FEEDBACK_MS = 1500;

export const ConsoleClipboardCopyButton = ({
  value,
  idleText,
  idleAriaLabel,
  copiedAriaLabel,
  className,
}: ConsoleClipboardCopyButtonProps) => {
  const [copied, setCopied] = useState(false);
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
    await navigator.clipboard.writeText(value);
    setCopied(true);
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, COPIED_FEEDBACK_MS);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={copied ? copiedAriaLabel : idleAriaLabel}
      onClick={handleCopy}
    >
      {copied ? 'Copied' : idleText}
    </Button>
  );
};
