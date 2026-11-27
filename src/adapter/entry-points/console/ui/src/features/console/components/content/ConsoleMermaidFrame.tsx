import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import {
  createMermaidFrameRenderRequest,
  MERMAID_FRAME_PATH,
  parseMermaidFrameResponse,
} from '../../lib/mermaidFrameProtocol';

export const MERMAID_FRAME_RESPONSE_TIMEOUT_MS = 15_000;

export type ConsoleMermaidFrameProps = {
  code: string;
  fillWidth: boolean;
  frameSource?: string;
};

type MermaidFrameState =
  | { status: 'loading' }
  | { status: 'ready'; height: number }
  | { status: 'failed'; message: string };

const clearResponseTimer = (timerRef: MutableRefObject<number | null>) => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

const TIMEOUT_MESSAGE = `Mermaid frame did not respond within ${MERMAID_FRAME_RESPONSE_TIMEOUT_MS / 1000} seconds`;

export const ConsoleMermaidFrame = ({
  code,
  fillWidth,
  frameSource = MERMAID_FRAME_PATH,
}: ConsoleMermaidFrameProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const latestRequestIdRef = useRef<number>(0);
  const responseTimerRef = useRef<number | null>(null);
  const [isFrameLoaded, setIsFrameLoaded] = useState<boolean>(false);
  const [state, setState] = useState<MermaidFrameState>({ status: 'loading' });

  useEffect(() => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!isFrameLoaded || frameWindow === null || frameWindow === undefined) {
      return;
    }
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;
    setState({ status: 'loading' });
    clearResponseTimer(responseTimerRef);
    responseTimerRef.current = window.setTimeout(() => {
      responseTimerRef.current = null;
      if (latestRequestIdRef.current === requestId) {
        setState({ status: 'failed', message: TIMEOUT_MESSAGE });
      }
    }, MERMAID_FRAME_RESPONSE_TIMEOUT_MS);
    frameWindow.postMessage(
      createMermaidFrameRenderRequest(requestId, code, fillWidth),
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
      clearResponseTimer(responseTimerRef);
      setState(
        response.type === 'size'
          ? { status: 'ready', height: response.height }
          : { status: 'failed', message: response.message },
      );
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearResponseTimer(responseTimerRef);
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
        src={frameSource}
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
