import { useState } from 'react';
import { ConsoleMermaidDiagramModalScreen } from './ConsoleMermaidDiagramModalScreen';
import { ConsoleMermaidFrame } from './ConsoleMermaidFrame';

export type ConsoleMermaidDiagramProps = {
  code: string;
  frameSource?: string;
};

export const ConsoleMermaidDiagram = ({
  code,
  frameSource,
}: ConsoleMermaidDiagramProps) => {
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false);

  return (
    <div className="console-mermaid-diagram">
      <ConsoleMermaidFrame
        code={code}
        fillWidth={false}
        frameSource={frameSource}
      />
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
          frameSource={frameSource}
          onClose={() => setIsEnlarged(false)}
        />
      )}
    </div>
  );
};
