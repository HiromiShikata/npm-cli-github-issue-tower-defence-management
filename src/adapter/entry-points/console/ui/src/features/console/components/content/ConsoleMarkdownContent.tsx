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
import { ConsoleInlineCodeCopy } from '../shared/ConsoleInlineCodeCopy';
import { ConsoleCopyCodeButton } from './ConsoleCopyCodeButton';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

export type ConsoleReferenceLinkRenderer = (
  href: string,
  fallbackText: string,
) => ReactNode;

export type ConsoleCheckboxToggleHandler = (
  checkboxIndex: number,
  checked: boolean,
) => void;

export type ConsoleMarkdownViewProps = {
  body: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
  onCheckboxToggle?: ConsoleCheckboxToggleHandler;
};

type ConsoleMarkdownHtmlBlockProps = {
  source: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
  onCheckboxToggle?: ConsoleCheckboxToggleHandler;
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

type InlineCodeMount = {
  key: string;
  host: HTMLElement;
  code: string;
};

const collectInlineCodeMounts = (container: HTMLElement): InlineCodeMount[] => {
  const codeElements = container.querySelectorAll<HTMLElement>('code');
  const mounts: InlineCodeMount[] = [];
  codeElements.forEach((codeElement, index) => {
    if (codeElement.closest('pre') !== null) {
      return;
    }
    const code = codeElement.textContent ?? '';
    const host = document.createElement('span');
    host.className = 'console-markdown-inline-code-host';
    codeElement.replaceWith(host);
    mounts.push({ key: `inline-code:${index}`, host, code });
  });
  return mounts;
};

const attachCheckboxClickHandlers = (
  container: HTMLElement,
  onCheckboxToggle: ConsoleCheckboxToggleHandler | undefined,
): (() => void) => {
  const checkboxes = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-checkbox-index]',
    ),
  );
  const detachers = checkboxes.flatMap((checkbox) => {
    const indexAttribute = checkbox.getAttribute('data-checkbox-index');
    if (indexAttribute === null) {
      return [];
    }
    const checkboxIndex = Number(indexAttribute);
    if (onCheckboxToggle === undefined) {
      // Keeps the checkbox inert: a disabled checkbox must never change its
      // checked state on click, matching how a real browser blocks clicks on
      // disabled form controls.
      const blockClick = (event: Event): void => {
        event.preventDefault();
      };
      checkbox.addEventListener('click', blockClick);
      return [() => checkbox.removeEventListener('click', blockClick)];
    }
    checkbox.disabled = false;
    const handleClick = (): void => {
      onCheckboxToggle(checkboxIndex, checkbox.checked);
    };
    checkbox.addEventListener('click', handleClick);
    return [() => checkbox.removeEventListener('click', handleClick)];
  });
  return () => {
    detachers.forEach((detach) => {
      detach();
    });
  };
};

const ConsoleMarkdownHtmlBlock = ({
  source,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
  onCheckboxToggle,
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
  const [inlineCodeMounts, setInlineCodeMounts] = useState<InlineCodeMount[]>(
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    container.innerHTML = html;
    setCodeBlockMounts(collectCodeBlockMounts(container));
    setInlineCodeMounts(collectInlineCodeMounts(container));
    setReferenceMounts(
      renderReferenceLink === undefined
        ? []
        : collectReferenceMounts(container),
    );
    return attachCheckboxClickHandlers(container, onCheckboxToggle);
  }, [html, renderReferenceLink, onCheckboxToggle]);

  return (
    <div ref={containerRef} className="console-markdown">
      {codeBlockMounts.map((mount) =>
        createPortal(
          <ConsoleCopyCodeButton code={mount.code} />,
          mount.host,
          mount.key,
        ),
      )}
      {inlineCodeMounts.map((mount) =>
        createPortal(
          <ConsoleInlineCodeCopy code={mount.code} />,
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
  onCheckboxToggle,
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
            onCheckboxToggle={onCheckboxToggle}
          />
        ),
      )}
    </div>
  );
};
