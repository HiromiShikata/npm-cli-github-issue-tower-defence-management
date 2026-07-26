import DOMPurify from 'dompurify';
import { nameToEmoji } from 'gemoji';
import { marked, type Tokens } from 'marked';
import { markedEmoji } from 'marked-emoji';
import type { ConsoleRepoContext } from '../logic/references';

export type { ConsoleRepoContext } from '../logic/references';

type IssueReferenceToken = Tokens.Generic & {
  type: 'consoleIssueReference';
  raw: string;
  numberText: string;
};

const ISSUE_REFERENCE_PATTERN = /^#(\d+)\b/;

let activeRepoContext: ConsoleRepoContext | null = null;

const issueReferenceHref = (numberText: string): string | null => {
  if (activeRepoContext === null) {
    return null;
  }
  const { owner, repo } = activeRepoContext;
  return `https://github.com/${owner}/${repo}/issues/${numberText}`;
};

marked.use(
  markedEmoji({
    emojis: nameToEmoji,
    renderer: (token) => token.emoji,
  }),
);

marked.use({
  extensions: [
    {
      name: 'consoleIssueReference',
      level: 'inline',
      start(src: string) {
        const index = src.indexOf('#');
        return index === -1 ? undefined : index;
      },
      tokenizer(src: string): IssueReferenceToken | undefined {
        if (activeRepoContext === null) {
          return undefined;
        }
        const match = ISSUE_REFERENCE_PATTERN.exec(src);
        if (match === null) {
          return undefined;
        }
        return {
          type: 'consoleIssueReference',
          raw: match[0],
          numberText: match[1],
        };
      },
      renderer(token: Tokens.Generic): string {
        const reference = token as IssueReferenceToken;
        const href = issueReferenceHref(reference.numberText);
        if (href === null) {
          return reference.raw;
        }
        return `<a href="${href}">#${reference.numberText}</a>`;
      },
    },
  ],
});

export const renderMarkdownToSafeHtml = (
  source: string,
  repoContext?: ConsoleRepoContext,
): string => {
  const trimmed = source.trim();
  if (trimmed === '') {
    return '';
  }
  activeRepoContext = repoContext ?? null;
  marked.setOptions({ gfm: true, breaks: true });
  try {
    const parsed = marked.parse(source, { async: false });
    const rawHtml = typeof parsed === 'string' ? parsed : '';
    return DOMPurify.sanitize(rawHtml);
  } finally {
    activeRepoContext = null;
  }
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
