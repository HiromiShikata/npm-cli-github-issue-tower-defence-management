import { renderMermaidToSvg } from './mermaidLoader';

const initialize = jest.fn();
const render = jest.fn(async () => ({
  svg: '<svg><script>alert(1)</script><g></g></svg>',
}));

describe('renderMermaidToSvg', () => {
  beforeEach(() => {
    initialize.mockClear();
    render.mockClear();
    (window as unknown as { mermaid: unknown }).mermaid = {
      initialize,
      render,
    };
  });

  it('initializes mermaid once and returns sanitized svg without scripts', async () => {
    const first = await renderMermaidToSvg('graph TD; A-->B;');
    const second = await renderMermaidToSvg('graph TD; C-->D;');
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
    expect(first).not.toContain('<script>');
    expect(first).toContain('<svg');
    expect(second).not.toContain('alert(1)');
  });
});
