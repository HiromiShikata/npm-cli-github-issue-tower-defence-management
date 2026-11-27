import DOMPurify from 'dompurify';
import type { MermaidApi } from './mermaidFrameLoader';
import {
  type MermaidFrameRenderRequest,
  type MermaidFrameResponse,
  parseMermaidFrameRequest,
} from './mermaidFrameProtocol';

export type MermaidFrameRenderDeps = {
  renderDiagram: (id: string, code: string) => Promise<{ svg: string }>;
  sanitizeSvg: (svg: string) => string;
  showDiagram: (svg: string, fillWidth: boolean) => void;
  measureHeight: () => number;
  isLatest?: () => boolean;
};

export const renderMermaidFrameRequest = async (
  request: MermaidFrameRenderRequest,
  deps: MermaidFrameRenderDeps,
): Promise<MermaidFrameResponse> => {
  try {
    const { svg } = await deps.renderDiagram(
      `mermaid-frame-${request.requestId}`,
      request.code,
    );
    if (deps.isLatest !== undefined && !deps.isLatest()) {
      return {
        type: 'failed',
        requestId: request.requestId,
        message: 'superseded by a newer request',
      };
    }
    deps.showDiagram(deps.sanitizeSvg(svg), request.fillWidth);
    return {
      type: 'size',
      requestId: request.requestId,
      height: deps.measureHeight(),
    };
  } catch (cause) {
    return {
      type: 'failed',
      requestId: request.requestId,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
};

export const sanitizeMermaidFrameSvg = (svg: string): string =>
  DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject'],
  });

export type MermaidFrameHandleDeps = Omit<
  MermaidFrameRenderDeps,
  'renderDiagram'
> & {
  loadMermaid: () => Promise<Pick<MermaidApi, 'render'>>;
};

export const handleMermaidFrameRequest = async (
  request: MermaidFrameRenderRequest,
  deps: MermaidFrameHandleDeps,
): Promise<MermaidFrameResponse> => {
  let mermaid: Pick<MermaidApi, 'render'>;
  try {
    mermaid = await deps.loadMermaid();
  } catch (cause) {
    return {
      type: 'failed',
      requestId: request.requestId,
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }
  return renderMermaidFrameRequest(request, {
    ...deps,
    renderDiagram: (id, code) => mermaid.render(id, code),
  });
};

export const showMermaidFrameDiagram = (
  container: HTMLElement,
  svg: string,
  fillWidth: boolean,
): void => {
  container.innerHTML = svg;
  const diagram = container.querySelector('svg');
  if (diagram !== null && fillWidth) {
    diagram.style.setProperty('width', '100%');
    diagram.style.setProperty('height', 'auto');
  }
};

export type MermaidFrameMessageHandlerDeps = {
  isParentSource: (source: unknown) => boolean;
  handle: (
    request: MermaidFrameRenderRequest,
    isLatest: () => boolean,
  ) => Promise<MermaidFrameResponse>;
  post: (response: MermaidFrameResponse) => void;
  onSized: (requestId: number) => void;
};

export const createMermaidFrameMessageHandler = (
  deps: MermaidFrameMessageHandlerDeps,
) => {
  let latestRequestId: number | null = null;
  return (event: { source: unknown; data: unknown }): void => {
    if (!deps.isParentSource(event.source)) {
      return;
    }
    const request = parseMermaidFrameRequest(event.data);
    if (request === null) {
      return;
    }
    latestRequestId = request.requestId;
    const requestId = request.requestId;
    const isLatest = () => latestRequestId === requestId;
    void deps.handle(request, isLatest).then((response) => {
      if (response.type === 'size') {
        deps.onSized(response.requestId);
      }
      deps.post(response);
    });
  };
};

