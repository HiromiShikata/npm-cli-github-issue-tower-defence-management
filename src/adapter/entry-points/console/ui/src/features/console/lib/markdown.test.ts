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

  it('renders GitHub emoji shortcodes as Unicode emoji glyphs', () => {
    const html = renderMarkdownToSafeHtml(':magic_wand: :sparkles: :rocket:');
    expect(html).toContain('🪄');
    expect(html).toContain('✨');
    expect(html).toContain('🚀');
    expect(html).not.toContain(':magic_wand:');
    expect(html).not.toContain(':sparkles:');
    expect(html).not.toContain(':rocket:');
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

  it('keeps a regular fenced code block as a single markdown segment', () => {
    const segments = splitMarkdownSegments('```ts\nconst answer = 42;\n```');
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: '```ts\nconst answer = 42;\n```' },
    ]);
    const html = renderMarkdownToSafeHtml(
      (segments[0] as { source: string }).source,
    );
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('const answer = 42;');
    expect(html).not.toContain('```');
  });

  it('does not treat a mermaid fence inside a regular code block as a diagram', () => {
    const segments = splitMarkdownSegments(
      '```text\n```mermaid\ngraph TD; A-->B;\n```\n```',
    );
    expect(segments.map(stripKey)).toEqual([
      {
        kind: 'markdown',
        source: '```text\n```mermaid\ngraph TD; A-->B;\n```\n```',
      },
    ]);
  });

  it('separates a mermaid fence from a following regular code fence', () => {
    const segments = splitMarkdownSegments(
      'intro\n\n```mermaid\ngraph TD; A-->B;\n```\n\n```ts\nconst answer = 42;\n```',
    );
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: 'intro\n' },
      { kind: 'mermaid', code: 'graph TD; A-->B;' },
      { kind: 'markdown', source: '\n```ts\nconst answer = 42;\n```' },
    ]);
    const codeSegment = segments[2] as { source: string };
    const html = renderMarkdownToSafeHtml(codeSegment.source);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).not.toContain('```');
  });

  it('keeps an unterminated regular fence as markdown', () => {
    const segments = splitMarkdownSegments('```ts\nconst answer = 42;');
    expect(segments.map(stripKey)).toEqual([
      { kind: 'markdown', source: '```ts\nconst answer = 42;' },
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
