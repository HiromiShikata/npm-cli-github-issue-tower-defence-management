import { loadMermaidApi, type MermaidApi } from './mermaidFrameLoader';
import type { MermaidFrameResponse } from './mermaidFrameProtocol';
import {
  createMermaidFrameMessageHandler,
  handleMermaidFrameRequest,
  sanitizeMermaidFrameSvg,
  showMermaidFrameDiagram,
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

let displayedRequestId: number | null = null;

window.addEventListener(
  'message',
  createMermaidFrameMessageHandler({
    isParentSource: (source) => source === window.parent,
    handle: (request, isLatest) =>
      handleMermaidFrameRequest(request, {
        loadMermaid,
        isLatest,
        sanitizeSvg: sanitizeMermaidFrameSvg,
        showDiagram: (svg, fillWidth) =>
          showMermaidFrameDiagram(document.body, svg, fillWidth),
        measureHeight: () => document.documentElement.scrollHeight,
      }),
    post: postToParent,
    onSized: (requestId) => {
      displayedRequestId = requestId;
    },
  }),
);

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
