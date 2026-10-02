import { useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '../../logic/clipboard';

export type ConsoleInlineCodeCopyProps = {
  code: string;
};

type ConsoleInlineCodeCopyState = 'idle' | 'copied' | 'failed';

const COPIED_FEEDBACK_MS = 1500;

export const ConsoleInlineCodeCopy = ({ code }: ConsoleInlineCodeCopyProps) => {
  const [copyState, setCopyState] = useState<ConsoleInlineCodeCopyState>(
    'idle',
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleActivate = async () => {
    try {
      await copyTextToClipboard(code);
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

  return (
    <>
      <button
        type="button"
        className="console-inline-code-copy-trigger"
        style={{ cursor: 'pointer' }}
        aria-label={
          copyState === 'copied'
            ? 'Code copied to clipboard'
            : copyState === 'failed'
              ? 'Copying to the clipboard failed'
              : undefined
        }
        onClick={handleActivate}
      >
        <code>{code}</code>
      </button>
      {copyState !== 'idle' && (
        <span role="status" className="console-inline-code-copy-tooltip">
          {copyState === 'copied' ? 'Copied' : 'Copy failed'}
        </span>
      )}
    </>
  );
};
