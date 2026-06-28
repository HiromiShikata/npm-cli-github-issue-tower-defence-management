import { ConsoleReferenceLink } from '../components/content/ConsoleReferenceLink';
import { useConsoleReferenceLink } from '../hooks/useConsoleReferenceLink';
import type { ResourceCache } from '../lib/resourceCache';
import type { ConsoleIssueState } from '../logic/types';

export type ConsoleReferenceLinkContainerProps = {
  cache: ResourceCache<ConsoleIssueState>;
  href: string;
  fallbackText: string;
};

export const ConsoleReferenceLinkContainer = ({
  cache,
  href,
  fallbackText,
}: ConsoleReferenceLinkContainerProps) => {
  const state = useConsoleReferenceLink(cache, href);
  return (
    <ConsoleReferenceLink
      href={href}
      fallbackText={fallbackText}
      state={state}
    />
  );
};
