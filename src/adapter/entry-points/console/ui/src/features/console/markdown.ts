import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export const renderMarkdownToSafeHtml = (source: string): string => {
  const rawHtml = marked.parse(source, { async: false });
  return DOMPurify.sanitize(rawHtml);
};

export const MERMAID_FENCE_SELECTOR =
  'code.language-mermaid, code.lang-mermaid';

export const extractMermaidSources = (html: string): string[] => {
  const container = document.createElement('div');
  container.innerHTML = html;
  const blocks = container.querySelectorAll(MERMAID_FENCE_SELECTOR);
  const sources: string[] = [];
  blocks.forEach((block) => {
    const text = block.textContent ?? '';
    if (text.trim() !== '') {
      sources.push(text);
    }
  });
  return sources;
};
