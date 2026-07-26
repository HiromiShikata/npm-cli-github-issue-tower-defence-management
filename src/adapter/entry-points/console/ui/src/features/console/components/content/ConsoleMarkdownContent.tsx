import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type ImageProxyUrlBuilder,
  rewriteGitHubImageSources,
} from '../../lib/imageProxy';
import {
  type ConsoleRepoContext,
  renderMarkdownToSafeHtml,
  splitMarkdownSegments,
} from '../../lib/markdown';
import { parseGitHubReferenceUrl } from '../../logic/references';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

export type ConsoleReferenceLinkRenderer = (
  href: string,
  fallbackText: string,
) => ReactNode;

export type ConsoleMarkdownViewProps = {
  body: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
};

type ConsoleMarkdownHtmlBlockProps = {
  source: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
};

type ReferenceMount = {
  key: string;
  host: HTMLElement;
  href: string;
  fallbackText: string;
};

const collectReferenceMounts = (container: HTMLElement): ReferenceMount[] => {
  const anchors = container.querySelectorAll<HTMLAnchorElement>('a[href]');
  const mounts: ReferenceMount[] = [];
  anchors.forEach((anchor, index) => {
    const href = anchor.getAttribute('href') ?? '';
    if (parseGitHubReferenceUrl(href) === null) {
      return;
    }
    const fallbackText = anchor.textContent ?? href;
    const host = document.createElement('span');
    host.className = 'console-markdown-reference-host';
    anchor.replaceWith(host);
    mounts.push({ key: `${index}:${href}`, host, href, fallbackText });
  });
  return mounts;
};

const ConsoleMarkdownHtmlBlock = ({
  source,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
}: ConsoleMarkdownHtmlBlockProps) => {
  const html = useMemo(() => {
    const safeHtml = renderMarkdownToSafeHtml(source, repoContext);
    if (buildImageProxyUrl === undefined) {
      return safeHtml;
    }
    return rewriteGitHubImageSources(safeHtml, buildImageProxyUrl);
  }, [source, buildImageProxyUrl, repoContext]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [referenceMounts, setReferenceMounts] = useState<ReferenceMount[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    container.innerHTML = html;
    if (renderReferenceLink === undefined) {
      setReferenceMounts([]);
      return;
    }
    setReferenceMounts(collectReferenceMounts(container));
  }, [html, renderReferenceLink]);

  return (
    <div ref={containerRef} className="console-markdown">
      {renderReferenceLink !== undefined &&
        referenceMounts.map((mount) =>
          createPortal(
            renderReferenceLink(mount.href, mount.fallbackText),
            mount.host,
            mount.key,
          ),
        )}
    </div>
  );
};

export const ConsoleMarkdownContent = ({
  body,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
}: ConsoleMarkdownViewProps) => {
  const segments = useMemo(() => splitMarkdownSegments(body), [body]);

  if (body.trim() === '') {
    return <p className="console-markdown-empty">No description provided.</p>;
  }

  return (
    <div className="console-markdown-view">
      {segments.map((segment) =>
        segment.kind === 'mermaid' ? (
          <ConsoleMermaidDiagram key={segment.key} code={segment.code} />
        ) : (
          <ConsoleMarkdownHtmlBlock
            key={segment.key}
            source={segment.source}
            buildImageProxyUrl={buildImageProxyUrl}
            renderReferenceLink={renderReferenceLink}
            repoContext={repoContext}
          />
        ),
      )}
    </div>
  );
};
