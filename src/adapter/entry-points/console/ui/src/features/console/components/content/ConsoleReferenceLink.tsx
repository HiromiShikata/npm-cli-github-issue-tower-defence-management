import { referenceStateToIconInput } from '../../logic/references';
import type { ConsoleIssueState } from '../../logic/types';
import { ConsoleItemIcon } from '../detail/ConsoleItemIcon';

export type ConsoleReferenceLinkProps = {
  href: string;
  fallbackText: string;
  state: ConsoleIssueState | null;
};

export const ConsoleReferenceLink = ({
  href,
  fallbackText,
  state,
}: ConsoleReferenceLinkProps) => {
  if (state === null || state.title.trim() === '') {
    return (
      <a
        className="console-markdown-reference console-markdown-reference-plain"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {fallbackText}
      </a>
    );
  }
  return (
    <a
      className="console-markdown-reference"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ConsoleItemIcon {...referenceStateToIconInput(state)} />
      <span className="console-markdown-reference-title">{state.title}</span>
    </a>
  );
};
