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
import { ConsoleCopyCodeButton } from './ConsoleCopyCodeButton';
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

type CodeBlockMount = {
  key: string;
  host: HTMLElement;
  code: string;
};

const collectCodeBlockMounts = (container: HTMLElement): CodeBlockMount[] => {
  const codeElements = container.querySelectorAll<HTMLElement>('pre > code');
  const mounts: CodeBlockMount[] = [];
  codeElements.forEach((codeElement, index) => {
    const preElement = codeElement.parentElement;
    if (preElement === null) {
      return;
    }
    const code = codeElement.textContent ?? '';
    const wrapper = document.createElement('div');
    wrapper.className = 'console-markdown-code-block';
    const host = document.createElement('div');
    host.className = 'console-markdown-code-copy-host';
    preElement.replaceWith(wrapper);
    wrapper.append(host, preElement);
    mounts.push({ key: `code:${index}`, host, code });
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
  const [codeBlockMounts, setCodeBlockMounts] = useState<CodeBlockMount[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    container.innerHTML = html;
    setCodeBlockMounts(collectCodeBlockMounts(container));
    setReferenceMounts(
      renderReferenceLink === undefined
        ? []
        : collectReferenceMounts(container),
    );
  }, [html, renderReferenceLink]);

  return (
    <div ref={containerRef} className="console-markdown">
      {codeBlockMounts.map((mount) =>
        createPortal(
          <ConsoleCopyCodeButton code={mount.code} />,
          mount.host,
          mount.key,
        ),
      )}
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
