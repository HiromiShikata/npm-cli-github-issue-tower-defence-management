import { renderMermaidFencesIn, renderMermaidToSafeSvg } from './mermaid';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async (_id: string, source: string) => ({
      svg: source.includes('attack')
        ? '<svg><script>window.stolen = 1;</script><rect/></svg>'
        : '<svg><rect width="10" height="10"></rect></svg>',
    })),
  },
}));

describe('renderMermaidToSafeSvg', () => {
  it('returns sanitized SVG markup for a valid diagram', async () => {
    const svg = await renderMermaidToSafeSvg('graph TD\n A --> B');
    expect(svg).toContain('<svg');
    expect(svg).toContain('rect');
  });

  it('removes script content from the rendered SVG', async () => {
    const svg = await renderMermaidToSafeSvg('graph TD\n attack');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('window.stolen');
  });
});

describe('renderMermaidFencesIn', () => {
  it('replaces each mermaid fence with rendered SVG', async () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<pre><code class="language-mermaid">graph TD\n A --> B</code></pre>';
    await renderMermaidFencesIn(container);
    expect(container.querySelector('code.language-mermaid')).toBeNull();
    expect(
      container.querySelector('.console-mermaid-rendered svg'),
    ).not.toBeNull();
  });

  it('leaves a container without mermaid fences unchanged', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>no diagram here</p>';
    await renderMermaidFencesIn(container);
    expect(container.querySelector('.console-mermaid-rendered')).toBeNull();
  });
});
