import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export type ConsoleCopyUrlButtonProps = {
  url: string;
  label?: string;
};

const COPIED_FEEDBACK_MS = 1500;

export const ConsoleCopyUrlButton = ({
  url,
  label = 'Copy URL',
}: ConsoleCopyUrlButtonProps) => {
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
    await navigator.clipboard.writeText(url);
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
      className="console-copy-url-button"
      aria-label={copied ? 'URL copied to clipboard' : label}
      onClick={handleCopy}
    >
      {copied ? 'Copied' : 'Copy URL'}
    </Button>
  );
};
