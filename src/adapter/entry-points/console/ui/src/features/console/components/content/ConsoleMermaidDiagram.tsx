import { useState } from 'react';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';
import { ConsoleMermaidFrame } from './ConsoleMermaidFrame';

export type ConsoleMermaidDiagramProps = {
  code: string;
};

export const ConsoleMermaidDiagram = ({ code }: ConsoleMermaidDiagramProps) => {
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false);

  return (
    <div className="console-mermaid-diagram">
      <ConsoleMermaidFrame code={code} fillWidth={false} />
      <button
        type="button"
        className="console-mermaid-enlarge"
        onClick={() => setIsEnlarged(true)}
      >
        Enlarge diagram
      </button>
      {isEnlarged && (
        <ConsoleMermaidDiagramModalScreen
          code={code}
          onClose={() => setIsEnlarged(false)}
        />
      )}
    </div>
  );
};
