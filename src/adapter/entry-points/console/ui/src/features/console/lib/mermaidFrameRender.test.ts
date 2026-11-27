import type { MermaidFrameRenderRequest } from './mermaidFrameProtocol';
import {
  createMermaidFrameMessageHandler,
  handleMermaidFrameRequest,
  renderMermaidFrameRequest,
  sanitizeMermaidFrameSvg,
  showMermaidFrameDiagram,
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

describe('handleMermaidFrameRequest', () => {
  it('reports the loader failure as a failed response and shows nothing', async () => {
    const showDiagram = jest.fn();
    const response = await handleMermaidFrameRequest(request, {
      loadMermaid: jest.fn(async () => {
        throw new Error('mermaid script failed to load');
      }),
      sanitizeSvg: (svg: string) => svg,
      showDiagram,
      measureHeight: () => 0,
    });
    expect(showDiagram).not.toHaveBeenCalled();
    expect(response).toEqual({
      type: 'failed',
      requestId: 7,
      message: 'mermaid script failed to load',
    });
  });

  it('renders through the loaded api and reports the size', async () => {
    const render = jest.fn(async () => ({ svg: '<svg><g></g></svg>' }));
    const response = await handleMermaidFrameRequest(request, {
      loadMermaid: jest.fn(async () => ({ render })),
      sanitizeSvg: (svg: string) => svg,
      showDiagram: jest.fn(),
      measureHeight: () => 180,
    });
    expect(render).toHaveBeenCalledWith('mermaid-frame-7', request.code);
    expect(response).toEqual({ type: 'size', requestId: 7, height: 180 });
  });
});

describe('showMermaidFrameDiagram', () => {
  it('sets the diagram to the full width when asked to fill it', () => {
    const container = document.createElement('div');
    showMermaidFrameDiagram(container, '<svg id="d"></svg>', true);
    const diagram = container.querySelector<SVGSVGElement>('svg#d');
    expect(diagram?.style.width).toBe('100%');
    expect(diagram?.style.height).toBe('auto');
  });

  it('keeps the diagram at its own width when not asked to fill it', () => {
    const container = document.createElement('div');
    showMermaidFrameDiagram(
      container,
      '<svg id="d" style="max-width: 320px;"></svg>',
      false,
    );
    const diagram = container.querySelector<SVGSVGElement>('svg#d');
    expect(diagram?.style.width).toBe('');
    expect(diagram?.style.maxWidth).toBe('320px');
  });
});

describe('showMermaidFrameDiagram page reset', () => {
  it('removes the default page margin and background so the diagram sits at the frame origin', () => {
    const container = document.createElement('div');
    showMermaidFrameDiagram(
      container,
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      false,
    );
    expect(container.style.margin).toBe('0px');
    expect(container.style.padding).toBe('0px');
    expect(container.style.background).toBe('transparent');
  });
});

describe('createMermaidFrameMessageHandler', () => {
  const request = {
    type: 'render' as const,
    requestId: 4,
    code: 'graph TD; A-->B;',
    fillWidth: false,
  };

  const build = (handle: jest.Mock) => {
    const post = jest.fn();
    const onSized = jest.fn();
    const handler = createMermaidFrameMessageHandler({
      isParentSource: (source) => source === 'parent',
      handle,
      post,
      onSized,
    });
    return { handler, post, onSized };
  };

  it('ignores messages from any source other than the parent', () => {
    const handle = jest.fn();
    const { handler, post } = build(handle);
    handler({ source: 'other', data: request } as unknown as MessageEvent);
    expect(handle).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('ignores data that is not a render request', () => {
    const handle = jest.fn();
    const { handler } = build(handle);
    handler({
      source: 'parent',
      data: { type: 'eval' },
    } as unknown as MessageEvent);
    expect(handle).not.toHaveBeenCalled();
  });

  it('posts the failed response of a diagram that did not load', async () => {
    const failed = {
      type: 'failed' as const,
      requestId: 4,
      message: 'mermaid script failed to load',
    };
    const handle = jest.fn(async () => failed);
    const { handler, post, onSized } = build(handle);
    handler({ source: 'parent', data: request } as unknown as MessageEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledWith(failed);
    expect(onSized).not.toHaveBeenCalled();
  });

  it('posts the size response and records the displayed request', async () => {
    const size = { type: 'size' as const, requestId: 4, height: 210 };
    const handle = jest.fn(async () => size);
    const { handler, post, onSized } = build(handle);
    handler({ source: 'parent', data: request } as unknown as MessageEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledWith(size);
    expect(onSized).toHaveBeenCalledWith(4);
  });
});

describe('superseded render requests', () => {
  it('does not show a diagram that a newer request has superseded', async () => {
    const showDiagram = jest.fn();
    const response = await renderMermaidFrameRequest(request, {
      renderDiagram: jest.fn(async () => ({ svg: '<svg id="old"></svg>' })),
      sanitizeSvg: (svg: string) => svg,
      showDiagram,
      measureHeight: () => 100,
      isLatest: () => false,
    });
    expect(showDiagram).not.toHaveBeenCalled();
    expect(response).toEqual({
      type: 'failed',
      requestId: 7,
      message: 'superseded by a newer request',
    });
  });

  it('tells each render whether a newer request has started since it was received', () => {
    const handle = jest.fn(
      async (
        _request: MermaidFrameRenderRequest,
        _isLatest: () => boolean,
      ) => ({
        type: 'size' as const,
        requestId: 1,
        height: 1,
      }),
    );
    const handler = createMermaidFrameMessageHandler({
      isParentSource: (source) => source === 'parent',
      handle,
      post: jest.fn(),
      onSized: jest.fn(),
    });
    const first = { type: 'render', requestId: 1, code: 'a', fillWidth: false };
    const second = {
      type: 'render',
      requestId: 2,
      code: 'b',
      fillWidth: false,
    };
    handler({ source: 'parent', data: first });
    const firstIsLatest = handle.mock.calls[0][1];
    handler({ source: 'parent', data: second });
    const secondIsLatest = handle.mock.calls[1][1];
    expect(firstIsLatest()).toBe(false);
    expect(secondIsLatest()).toBe(true);
  });
});
