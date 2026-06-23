import {
  type ConsoleMarkdownSegment,
  hasMermaidFence,
  renderMarkdownToSafeHtml,
  splitMarkdownSegments,
} from './markdown';

const stripKey = (segment: ConsoleMarkdownSegment): Record<string, unknown> => {
  if (segment.kind === 'mermaid') {
    return { kind: segment.kind, code: segment.code };
  }
  return { kind: segment.kind, source: segment.source };
};

describe('renderMarkdownToSafeHtml', () => {
  it('renders headings and lists', () => {
    const html = renderMarkdownToSafeHtml('# Title\n\n- one\n- two');
    expect(html).toContain('<h1');
    expect(html).toContain('<li>one</li>');
  });

  it('renders GitHub-flavored markdown tables', () => {
    const html = renderMarkdownToSafeHtml(
      '| Name | Value |\n| --- | --- |\n| one | 1 |',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>one</td>');
  });

  it('strips script tags via DOMPurify', () => {
    const html = renderMarkdownToSafeHtml(
      'before <script>alert(1)</script> after',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(1)');
  });

  it('strips event-handler attributes', () => {
    const html = renderMarkdownToSafeHtml('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('returns an empty string for blank input', () => {
    expect(renderMarkdownToSafeHtml('   ')).toBe('');
  });
});

describe('splitMarkdownSegments', () => {
  it('separates a mermaid fence from surrounding markdown', () => {
    const segments = splitMarkdownSegments(
      'intro\n\n```mermaid\ngraph TD; A-->B;\n```\n\noutro',
    );
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: 'intro\n' },
      { kind: 'mermaid', code: 'graph TD; A-->B;' },
      { kind: 'markdown', source: '\noutro' },
    ]);
    expect(new Set(segments.map((segment) => segment.key)).size).toBe(3);
  });

  it('keeps plain markdown as a single segment', () => {
    const segments = splitMarkdownSegments('just text');
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: 'just text' },
    ]);
  });

  it('keeps an unterminated mermaid fence as markdown', () => {
    const segments = splitMarkdownSegments('```mermaid\ngraph TD; A-->B;');
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: '```mermaid\ngraph TD; A-->B;' },
    ]);
  });
});

describe('hasMermaidFence', () => {
  it('detects a mermaid fence', () => {
    expect(hasMermaidFence('```mermaid\ngraph TD; A-->B;\n```')).toBe(true);
  });

  it('returns false without a mermaid fence', () => {
    expect(hasMermaidFence('```ts\nconst a = 1;\n```')).toBe(false);
  });
});
