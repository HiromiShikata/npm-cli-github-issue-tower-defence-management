import type { MermaidFrameRenderRequest } from './mermaidFrameProtocol';
import {
  renderMermaidFrameRequest,
  sanitizeMermaidFrameSvg,
} from './mermaidFrameRender';

const request: MermaidFrameRenderRequest = {
  type: 'render',
  requestId: 7,
  code: 'graph TD; A-->B;',
  fillWidth: false,
};

const buildDeps = (overrides: {
  renderDiagram?: jest.Mock;
  sanitizeSvg?: (svg: string) => string;
  height?: number;
}) => {
  const showDiagram = jest.fn();
  return {
    showDiagram,
    deps: {
      renderDiagram:
        overrides.renderDiagram ??
        jest.fn(async () => ({ svg: '<svg><g></g></svg>' })),
      sanitizeSvg: overrides.sanitizeSvg ?? ((svg: string) => svg),
      showDiagram,
      measureHeight: () => overrides.height ?? 240,
    },
  };
};

describe('renderMermaidFrameRequest', () => {
  it('shows the sanitized diagram and reports its height under the request id', async () => {
    const renderDiagram = jest.fn(async () => ({
      svg: '<svg><script>alert(1)</script><g></g></svg>',
    }));
    const { deps, showDiagram } = buildDeps({
      renderDiagram,
      sanitizeSvg: (svg) => svg.split('<script>alert(1)</script>').join(''),
      height: 310,
    });
    const response = await renderMermaidFrameRequest(
      { ...request, fillWidth: true },
      deps,
    );
    expect(renderDiagram).toHaveBeenCalledWith('mermaid-frame-7', request.code);
    expect(showDiagram).toHaveBeenCalledWith('<svg><g></g></svg>', true);
    expect(response).toEqual({ type: 'size', requestId: 7, height: 310 });
  });

  it('reports the error message when rendering throws', async () => {
    const { deps, showDiagram } = buildDeps({
      renderDiagram: jest.fn(async () => {
        throw new Error('parse error');
      }),
    });
    const response = await renderMermaidFrameRequest(request, deps);
    expect(showDiagram).not.toHaveBeenCalled();
    expect(response).toEqual({
      type: 'failed',
      requestId: 7,
      message: 'parse error',
    });
  });

  it('reports a non-Error rejection as its string form', async () => {
    const { deps } = buildDeps({
      renderDiagram: jest.fn(async () => {
        throw 'bad input';
      }),
    });
    const response = await renderMermaidFrameRequest(request, deps);
    expect(response).toEqual({
      type: 'failed',
      requestId: 7,
      message: 'bad input',
    });
  });
});

describe('sanitizeMermaidFrameSvg', () => {
  it('keeps the label text Mermaid places in foreignObject and drops scripts', () => {
    const sanitized = sanitizeMermaidFrameSvg(
      '<svg><g><foreignObject><div><span class="nodeLabel">Alpha</span></div></foreignObject></g><script>alert(1)</script></svg>',
    );
    expect(sanitized).toContain('<foreignObject>Alpha</foreignObject>');
    expect(sanitized).not.toContain('<script');
  });
});
