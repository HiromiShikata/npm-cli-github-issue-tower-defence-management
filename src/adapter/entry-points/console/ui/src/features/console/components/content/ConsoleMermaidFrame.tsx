import { useEffect, useRef, useState } from 'react';
import {
  createMermaidFrameRenderRequest,
  MERMAID_FRAME_PATH,
  parseMermaidFrameResponse,
} from '../../lib/mermaidFrameProtocol';

export type ConsoleMermaidFrameProps = {
  code: string;
  fillWidth: boolean;
};

type MermaidFrameState =
  | { status: 'loading' }
  | { status: 'ready'; height: number }
  | { status: 'failed'; message: string };

export const ConsoleMermaidFrame = ({
  code,
  fillWidth,
}: ConsoleMermaidFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const latestRequestIdRef = useRef<number>(0);
  const [isFrameLoaded, setIsFrameLoaded] = useState<boolean>(false);
  const [state, setState] = useState<MermaidFrameState>({ status: 'loading' });

  useEffect(() => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!isFrameLoaded || frameWindow === null || frameWindow === undefined) {
      return;
    }
    latestRequestIdRef.current += 1;
    setState({ status: 'loading' });
    frameWindow.postMessage(
      createMermaidFrameRenderRequest(
        latestRequestIdRef.current,
        code,
        fillWidth,
      ),
      '*',
    );
  }, [code, fillWidth, isFrameLoaded]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frameWindow = frameRef.current?.contentWindow;
      if (frameWindow === null || event.source !== frameWindow) {
        return;
      }
      const response = parseMermaidFrameResponse(event.data);
      if (
        response === null ||
        response.requestId !== latestRequestIdRef.current
      ) {
        return;
      }
      setState(
        response.type === 'size'
          ? { status: 'ready', height: response.height }
          : { status: 'failed', message: response.message },
      );
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="console-mermaid">
      {state.status === 'loading' && (
        <div className="console-mermaid-loading">Rendering diagram...</div>
      )}
      {state.status === 'failed' && (
        <div className="console-mermaid-error">
          Mermaid render error: {state.message}
        </div>
      )}
      <iframe
        ref={frameRef}
        src={MERMAID_FRAME_PATH}
        title="Mermaid diagram"
        sandbox="allow-scripts"
        className="console-mermaid-frame"
        onLoad={() => setIsFrameLoaded(true)}
        style={{ height: state.status === 'ready' ? state.height : 0 }}
      />
      {state.status === 'failed' && (
        <pre className="console-mermaid-source">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};
