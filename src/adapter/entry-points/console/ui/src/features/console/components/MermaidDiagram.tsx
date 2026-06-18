import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { renderMermaidToSafeSvg } from '../mermaid';

export type MermaidDiagramProps = {
  source: string;
  className?: string;
};

export const MermaidDiagram = ({ source, className }: MermaidDiagramProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);
    renderMermaidToSafeSvg(source)
      .then((safeSvg) => {
        if (cancelled) {
          return;
        }
        const container = containerRef.current;
        if (container !== null) {
          container.innerHTML = safeSvg;
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-md border border-border bg-card p-3',
        className,
      )}
    >
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          Mermaid render error: {errorMessage}
        </p>
      )}
      <div
        ref={containerRef}
        className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      />
    </div>
  );
};
