import { extractMermaidSources, renderMarkdownToSafeHtml } from './markdown';

describe('renderMarkdownToSafeHtml', () => {
  it('renders GitHub Flavored Markdown to HTML', () => {
    const html = renderMarkdownToSafeHtml('# Title\n\n- one\n- two');
    expect(html).toContain('<h1');
    expect(html).toContain('<li>one</li>');
  });

  it('strips script tags during sanitization', () => {
    const html = renderMarkdownToSafeHtml(
      'Safe text <script>window.stolen = document.cookie;</script>',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('window.stolen');
  });

  it('strips inline event handler attributes', () => {
    const html = renderMarkdownToSafeHtml(
      '<img src="x" onerror="window.stolen = 1" />',
    );
    expect(html).not.toContain('onerror');
  });

  it('keeps the mermaid fence language class so diagrams can be located', () => {
    const html = renderMarkdownToSafeHtml(
      '```mermaid\ngraph TD\n  A --> B\n```',
    );
    expect(html).toContain('language-mermaid');
  });
});

describe('extractMermaidSources', () => {
  it('extracts the source of each mermaid fence', () => {
    const html = renderMarkdownToSafeHtml(
      '```mermaid\ngraph TD\n  A --> B\n```\n\n```ts\nconst a = 1;\n```',
    );
    const sources = extractMermaidSources(html);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toContain('graph TD');
  });

  it('returns an empty array when there is no mermaid fence', () => {
    const html = renderMarkdownToSafeHtml('Plain text only.');
    expect(extractMermaidSources(html)).toEqual([]);
  });
});
