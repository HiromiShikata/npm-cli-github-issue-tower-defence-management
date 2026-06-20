import { useEffect, useMemo, useRef } from 'react';
import {
  renderMarkdownToSafeHtml,
  splitMarkdownSegments,
} from '../../lib/markdown';
import { ConsoleMermaidDiagram } from './ConsoleMermaidDiagram';

export type ConsoleMarkdownViewProps = {
  body: string;
};

type ConsoleMarkdownHtmlBlockProps = {
  source: string;
};

const ConsoleMarkdownHtmlBlock = ({
  source,
}: ConsoleMarkdownHtmlBlockProps) => {
  const html = useMemo(() => renderMarkdownToSafeHtml(source), [source]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container !== null) {
      container.innerHTML = html;
    }
  }, [html]);

  return <div ref={containerRef} className="console-markdown" />;
};

export const ConsoleMarkdownContent = ({ body }: ConsoleMarkdownViewProps) => {
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
          <ConsoleMarkdownHtmlBlock key={segment.key} source={segment.source} />
        ),
      )}
    </div>
  );
};
