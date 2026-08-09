import DOMPurify from 'dompurify';
import { nameToEmoji } from 'gemoji';
import { marked, type Tokens } from 'marked';
import { markedEmoji } from 'marked-emoji';
import type { ConsoleRepoContext } from '../logic/references';

export type { ConsoleRepoContext } from '../logic/references';

type IssueReferenceToken = Tokens.Generic & {
  type: 'consoleIssueReference';
  raw: string;
  href: string;
  label: string;
};

const SAME_REPOSITORY_REFERENCE_PATTERN = /^#(\d+)\b/;
const CROSS_REPOSITORY_REFERENCE_PATTERN = /^([\w.-]+)\/([\w.-]+)#(\d+)\b/;
const REFERENCE_START_PATTERN = /[\w.-]+\/[\w.-]+#\d|#\d/g;
const REFERENCE_PRECEDING_CHARACTER_PATTERN = /[\w/:@-]/;

let activeRepoContext: ConsoleRepoContext | null = null;

const issuesUrl = (owner: string, repo: string, numberText: string): string =>
  `https://github.com/${owner}/${repo}/issues/${numberText}`;

const isReferenceBoundary = (source: string, index: number): boolean =>
  index === 0 || !REFERENCE_PRECEDING_CHARACTER_PATTERN.test(source[index - 1]);

const referenceStartIndex = (source: string): number | undefined => {
  for (const match of source.matchAll(REFERENCE_START_PATTERN)) {
    if (match.index !== undefined && isReferenceBoundary(source, match.index)) {
      return match.index;
    }
  }
  return undefined;
};

const matchIssueReference = (
  source: string,
): IssueReferenceToken | undefined => {
  const crossRepositoryMatch = CROSS_REPOSITORY_REFERENCE_PATTERN.exec(source);
  if (crossRepositoryMatch !== null) {
    return {
      type: 'consoleIssueReference',
      raw: crossRepositoryMatch[0],
      href: issuesUrl(
        crossRepositoryMatch[1],
        crossRepositoryMatch[2],
        crossRepositoryMatch[3],
      ),
      label: crossRepositoryMatch[0],
    };
  }
  if (activeRepoContext === null) {
    return undefined;
  }
  const sameRepositoryMatch = SAME_REPOSITORY_REFERENCE_PATTERN.exec(source);
  if (sameRepositoryMatch === null) {
    return undefined;
  }
  return {
    type: 'consoleIssueReference',
    raw: sameRepositoryMatch[0],
    href: issuesUrl(
      activeRepoContext.owner,
      activeRepoContext.repo,
      sameRepositoryMatch[1],
    ),
    label: sameRepositoryMatch[0],
  };
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
        return referenceStartIndex(src);
      },
      tokenizer(src: string): IssueReferenceToken | undefined {
        return matchIssueReference(src);
      },
      renderer(token: Tokens.Generic): string {
        const reference = token as IssueReferenceToken;
        return `<a href="${reference.href}">${reference.label}</a>`;
      },
    },
  ],
});

const withLinksOpeningInNewTab = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const anchor of Array.from(template.content.querySelectorAll('a'))) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
  return template.innerHTML;
};

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
    return withLinksOpeningInNewTab(DOMPurify.sanitize(rawHtml));
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
