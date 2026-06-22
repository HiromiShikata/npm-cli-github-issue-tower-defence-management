import { useEffect, useMemo, useRef } from 'react';
import {
  type ImageProxyUrlBuilder,
  rewriteGitHubImageSources,
} from '../../lib/imageProxy';
import {
  renderMarkdownToSafeHtml,
  splitMarkdownSegments,
} from '../../lib/markdown';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

export type ConsoleMarkdownViewProps = {
  body: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
};

type ConsoleMarkdownHtmlBlockProps = {
  source: string;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
};

const ConsoleMarkdownHtmlBlock = ({
  source,
  buildImageProxyUrl,
}: ConsoleMarkdownHtmlBlockProps) => {
  const html = useMemo(() => {
    const safeHtml = renderMarkdownToSafeHtml(source);
    if (buildImageProxyUrl === undefined) {
      return safeHtml;
    }
    return rewriteGitHubImageSources(safeHtml, buildImageProxyUrl);
  }, [source, buildImageProxyUrl]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container !== null) {
      container.innerHTML = html;
    }
  }, [html]);

  return <div ref={containerRef} className="console-markdown" />;
};

export const ConsoleMarkdownContent = ({
  body,
  buildImageProxyUrl,
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
          />
        ),
      )}
    </div>
  );
};
