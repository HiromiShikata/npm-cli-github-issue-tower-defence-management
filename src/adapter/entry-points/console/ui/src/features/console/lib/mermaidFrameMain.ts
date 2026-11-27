import {
  type MermaidFrameResponse,
  parseMermaidFrameRequest,
} from './mermaidFrameProtocol';
import {
  renderMermaidFrameRequest,
  sanitizeMermaidFrameSvg,
} from './mermaidFrameRender';

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

export const MERMAID_SCRIPT_URL =
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.6/dist/mermaid.min.js';

let mermaidApiPromise: Promise<MermaidApi> | null = null;

const loadMermaidApi = (): Promise<MermaidApi> => {
  if (mermaidApiPromise !== null) {
    return mermaidApiPromise;
  }
  mermaidApiPromise = new Promise<MermaidApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MERMAID_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.mermaid === undefined) {
        reject(new Error('mermaid failed to load'));
        return;
      }
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
        themeVariables: {
          background: '#0d1117',
          primaryColor: '#161b22',
          primaryTextColor: '#e6edf3',
          primaryBorderColor: '#30363d',
          lineColor: '#8b949e',
          fontSize: '14px',
        },
      });
      resolve(window.mermaid);
    };
    script.onerror = () => reject(new Error('mermaid script failed to load'));
    document.head.appendChild(script);
  });
  return mermaidApiPromise;
};

const postToParent = (response: MermaidFrameResponse): void => {
  window.parent.postMessage(response, '*');
};

const showDiagram = (svg: string, fillWidth: boolean): void => {
  document.body.innerHTML = svg;
  const diagram = document.body.querySelector('svg');
  if (diagram !== null && fillWidth) {
    diagram.style.setProperty('width', '100%');
    diagram.style.setProperty('height', 'auto');
  }
};


let displayedRequestId: number | null = null;

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) {
    return;
  }
  const request = parseMermaidFrameRequest(event.data);
  if (request === null) {
    return;
  }
  void loadMermaidApi()
    .then((mermaid) =>
      renderMermaidFrameRequest(request, {
        renderDiagram: (id, code) => mermaid.render(id, code),
        sanitizeSvg: sanitizeMermaidFrameSvg,
        showDiagram,
        measureHeight: () => document.documentElement.scrollHeight,
      }),
    )
    .catch(
      (cause: unknown): MermaidFrameResponse => ({
        type: 'failed',
        requestId: request.requestId,
        message: cause instanceof Error ? cause.message : String(cause),
      }),
    )
    .then((response) => {
      if (response.type === 'size') {
        displayedRequestId = response.requestId;
      }
      postToParent(response);
    });
});

if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (displayedRequestId !== null) {
      postToParent({
        type: 'size',
        requestId: displayedRequestId,
        height: document.documentElement.scrollHeight,
      });
    }
  }).observe(document.documentElement);
}
