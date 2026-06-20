import { useEffect, useRef, useState } from 'react';
import { renderMermaidToSvg } from '../../lib/mermaidLoader';

export type ConsoleMermaidDiagramProps = {
  code: string;
};

type MermaidRenderState =
  | { status: 'loading' }
  | { status: 'ready'; svg: string }
  | { status: 'error'; message: string };

export const ConsoleMermaidDiagram = ({ code }: ConsoleMermaidDiagramProps) => {
  const [state, setState] = useState<MermaidRenderState>({ status: 'loading' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    renderMermaidToSvg(code)
      .then((svg) => {
        if (!cancelled) {
          setState({ status: 'ready', svg });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    container.innerHTML = state.status === 'ready' ? state.svg : '';
  }, [state]);

  if (state.status === 'loading') {
    return <div className="console-mermaid-loading">Rendering diagram...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="console-mermaid">
        <div className="console-mermaid-error">
          Mermaid render error: {state.message}
        </div>
        <pre className="console-mermaid-source">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return <div ref={containerRef} className="console-mermaid-rendered" />;
};
