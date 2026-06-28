import DOMPurify from 'dompurify';
import { nameToEmoji } from 'gemoji';
import { marked } from 'marked';
import { markedEmoji } from 'marked-emoji';

marked.use(
  markedEmoji({
    emojis: nameToEmoji,
    renderer: (token) => token.emoji,
  }),
);

export const renderMarkdownToSafeHtml = (source: string): string => {
  const trimmed = source.trim();
  if (trimmed === '') {
    return '';
  }
  marked.setOptions({ gfm: true, breaks: true });
  const parsed = marked.parse(source, { async: false });
  const rawHtml = typeof parsed === 'string' ? parsed : '';
  return DOMPurify.sanitize(rawHtml);
};

export type ConsoleMarkdownSegment =
  | { kind: 'markdown'; key: string; source: string }
  | { kind: 'mermaid'; key: string; code: string };

const MERMAID_FENCE = /^```mermaid[^\n]*\n([\s\S]*?)\n```$/;

const isMermaidFenceOpen = (line: string): boolean =>
  /^```mermaid\s*$/.test(line.trim());

const isCodeFenceOpen = (line: string): boolean =>
  /^```/.test(line.trim()) && !isMermaidFenceOpen(line);

const isFenceClose = (line: string): boolean => line.trim() === '```';

export const splitMarkdownSegments = (
  source: string,
): ConsoleMarkdownSegment[] => {
  const lines = source.split('\n');
  const segments: ConsoleMarkdownSegment[] = [];
  let markdownBuffer: string[] = [];
  let mermaidBuffer: string[] | null = null;
  let insideCodeFence = false;
  let sequence = 0;

  const flushMarkdown = (): void => {
    if (markdownBuffer.length > 0) {
      segments.push({
        kind: 'markdown',
        key: `markdown:${sequence}`,
        source: markdownBuffer.join('\n'),
      });
      sequence += 1;
      markdownBuffer = [];
    }
  };

  for (const line of lines) {
    if (insideCodeFence) {
      markdownBuffer.push(line);
      if (isFenceClose(line)) {
        insideCodeFence = false;
      }
      continue;
    }
    if (mermaidBuffer === null && isMermaidFenceOpen(line)) {
      flushMarkdown();
      mermaidBuffer = [];
      continue;
    }
    if (mermaidBuffer !== null) {
      if (isFenceClose(line)) {
        segments.push({
          kind: 'mermaid',
          key: `mermaid:${sequence}`,
          code: mermaidBuffer.join('\n'),
        });
        sequence += 1;
        mermaidBuffer = null;
        continue;
      }
      mermaidBuffer.push(line);
      continue;
    }
    if (isCodeFenceOpen(line)) {
      markdownBuffer.push(line);
      insideCodeFence = true;
      continue;
    }
    markdownBuffer.push(line);
  }

  if (mermaidBuffer !== null) {
    markdownBuffer.push('```mermaid', ...mermaidBuffer);
  }
  flushMarkdown();
  return segments;
};

export const hasMermaidFence = (source: string): boolean =>
  /```mermaid\s*\n/.test(source) || MERMAID_FENCE.test(source.trim());
