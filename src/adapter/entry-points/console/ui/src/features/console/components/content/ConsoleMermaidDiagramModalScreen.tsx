import { useEffect, useRef, useState } from 'react';
import {
  formatMermaidZoomScale,
  isMermaidZoomScaleAtMaximum,
  isMermaidZoomScaleAtMinimum,
  MERMAID_ZOOM_MIN_SCALE,
  mermaidZoomCanvasWidth,
  mermaidZoomScaleIn,
  mermaidZoomScaleOut,
} from '../../lib/mermaidZoom';

export type ConsoleMermaidDiagramModalScreenProps = {
  svg: string;
  onClose: () => void;
};

export const ConsoleMermaidDiagramModalScreen = ({
  svg,
  onClose,
}: ConsoleMermaidDiagramModalScreenProps) => {
  const [scale, setScale] = useState<number>(MERMAID_ZOOM_MIN_SCALE);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    canvas.innerHTML = svg;
    const diagram = canvas.querySelector('svg');
    if (diagram !== null) {
      diagram.style.removeProperty('max-width');
      diagram.style.setProperty('width', '100%');
      diagram.style.setProperty('height', 'auto');
    }
  }, [svg]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="console-mermaid-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged diagram"
    >
      <div className="console-mermaid-modal-bar">
        <button
          type="button"
          className="console-mermaid-modal-button"
          aria-label="Zoom out"
          disabled={isMermaidZoomScaleAtMinimum(scale)}
          onClick={() => setScale(mermaidZoomScaleOut(scale))}
        >
          −
        </button>
        <span className="console-mermaid-modal-scale">
          {formatMermaidZoomScale(scale)}
        </span>
        <button
          type="button"
          className="console-mermaid-modal-button"
          aria-label="Zoom in"
          disabled={isMermaidZoomScaleAtMaximum(scale)}
          onClick={() => setScale(mermaidZoomScaleIn(scale))}
        >
          +
        </button>
        <button
          type="button"
          className="console-mermaid-modal-close"
          aria-label="Close enlarged diagram"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="console-mermaid-modal-viewport">
        <div
          ref={canvasRef}
          className="console-mermaid-modal-canvas"
          style={{ width: mermaidZoomCanvasWidth(scale) }}
        />
      </div>
    </div>
  );
};
