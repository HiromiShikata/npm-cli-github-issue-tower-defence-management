import DOMPurify from 'dompurify';
import type { MermaidApi } from './mermaidFrameLoader';
import type {
  MermaidFrameRenderRequest,
  MermaidFrameResponse,
} from './mermaidFrameProtocol';

export type MermaidFrameRenderDeps = {
  renderDiagram: (id: string, code: string) => Promise<{ svg: string }>;
  sanitizeSvg: (svg: string) => string;
  showDiagram: (svg: string, fillWidth: boolean) => void;
  measureHeight: () => number;
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
