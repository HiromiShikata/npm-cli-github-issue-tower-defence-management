import { toClassicMermaidFrameHtml } from './mermaidFrameClassicScript';

describe('toClassicMermaidFrameHtml', () => {
  it('turns the module script that Vite emits into a classic script', () => {
    const html = '<!doctype html><html><head><script type="module" crossorigin src="/assets/mermaid-frame.js"></script></head><body></body></html>';
    expect(toClassicMermaidFrameHtml(html)).toBe(
      '<!doctype html><html><head><script src="/assets/mermaid-frame.js"></script></head><body></body></html>',
    );
  });

  it('removes the module type and the crossorigin attribute whatever their order', () => {
    const html = '<script crossorigin type="module" src="/assets/mermaid-frame.js"></script>';
    const result = toClassicMermaidFrameHtml(html);
    expect(result).not.toContain('type="module"');
    expect(result).not.toContain('crossorigin');
    expect(result).toContain('src="/assets/mermaid-frame.js"');
  });

  it('leaves a script that is already classic unchanged', () => {
    const html = '<script src="/assets/mermaid-frame.js"></script>';
    expect(toClassicMermaidFrameHtml(html)).toBe(html);
  });
});
