import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { renderMarkdownToSafeHtml } from '../markdown';
import { renderMermaidFencesIn } from '../mermaid';

export type MarkdownViewProps = {
  source: string;
  emptyText?: string;
  className?: string;
};

export const MarkdownView = ({
  source,
  emptyText = '(no description)',
  className,
}: MarkdownViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmed = source.trim();
  const safeHtml = useMemo(
    () => (trimmed === '' ? '' : renderMarkdownToSafeHtml(source)),
    [source, trimmed],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    container.innerHTML = safeHtml;
    void renderMermaidFencesIn(container);
  }, [safeHtml]);

  if (trimmed === '') {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        {emptyText}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'text-sm leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:text-xs',
        className,
      )}
    />
  );
};
