import { loadMermaidApi, type MermaidApi } from './mermaidFrameLoader';
import {
  type MermaidFrameResponse,
  parseMermaidFrameRequest,
} from './mermaidFrameProtocol';
import {
  handleMermaidFrameRequest,
  sanitizeMermaidFrameSvg,
} from './mermaidFrameRender';

let mermaidApiPromise: Promise<MermaidApi> | null = null;

const loadMermaid = (): Promise<MermaidApi> => {
  if (mermaidApiPromise === null) {
    mermaidApiPromise = loadMermaidApi({
      createScript: () => document.createElement('script'),
      appendScript: (script) => document.head.appendChild(script),
      readMermaid: () => window.mermaid,
    });
  }
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
  void handleMermaidFrameRequest(request, {
    loadMermaid,
    sanitizeSvg: sanitizeMermaidFrameSvg,
    showDiagram,
    measureHeight: () => document.documentElement.scrollHeight,
  }).then((response) => {
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
