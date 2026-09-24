import { useEffect, useRef, useState } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import type { ConsoleRepoContext } from '../../lib/markdown';
import {
  loadCommentExpandedKeys,
  saveCommentExpandedKeys,
} from '../../logic/commentExpandedStorage';
import { formatRelativeTime } from '../../logic/relativeTime';
import type {
  ConsoleComment,
  ConsoleFieldOption,
  ConsoleStoryEntry,
} from '../../logic/types';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';
import type { IssueCreateParams } from '../layout/IssueCreateModalDialog';
import { IssueCreateModalDialog } from '../layout/IssueCreateModalDialog';

const formatAsBlockquote = (body: string): string =>
  body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

const extractFirstLine = (body: string): string =>
  body.split('\n').find((line) => line.trim() !== '') ?? '';

const buildCommentKey = (comment: ConsoleComment): string =>
  `${comment.author}:${comment.createdAt}:${comment.body}`;

type ConsoleCommentBodyExpandedProps = {
  comment: ConsoleComment;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
};

const ConsoleCommentBodyExpanded = ({
  comment,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
}: ConsoleCommentBodyExpandedProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('click', stop);
    return () => el.removeEventListener('click', stop);
  }, []);
  return (
    <div ref={ref} className="console-comment-body-expanded">
      <ConsoleMarkdownContent
        body={comment.body}
        buildImageProxyUrl={buildImageProxyUrl}
        renderReferenceLink={renderReferenceLink}
        repoContext={repoContext}
      />
    </div>
  );
};

export type ConsoleCommentListProps = {
  comments: ConsoleComment[];
  isLoading: boolean;
  error: string | null;
  now: number;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
  persistenceKey?: string | null;
  issueUrl?: string;
  issueTitle?: string;
  storyEntries?: ConsoleStoryEntry[];
  agentOptions?: ConsoleFieldOption[];
  onCreateIssueFromComment?: (params: IssueCreateParams) => Promise<void>;
};

export const ConsoleCommentList = ({
  comments,
  isLoading,
  error,
  now,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
  persistenceKey = null,
  issueUrl,
  issueTitle,
  storyEntries,
  agentOptions,
  onCreateIssueFromComment,
}: ConsoleCommentListProps) => {
  const [showAll, setShowAll] = useState<boolean>(false);
  const [pendingComment, setPendingComment] = useState<ConsoleComment | null>(
    null,
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
    persistenceKey != null
      ? loadCommentExpandedKeys(persistenceKey)
      : new Set(),
  );

  const latestKey =
    comments.length > 0 ? buildCommentKey(comments[comments.length - 1]) : null;

  useEffect(() => {
    if (latestKey === null) return;
    setExpandedKeys((prev) => new Set([...prev, latestKey]));
  }, [latestKey]);

  useEffect(() => {
    if (persistenceKey == null) return;
    saveCommentExpandedKeys(persistenceKey, expandedKeys);
  }, [persistenceKey, expandedKeys]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (error !== null) {
    return <p className="console-comment-notloaded">Not loaded.</p>;
  }

  if (isLoading) {
    return <p className="console-comment-loading">Loading comments...</p>;
  }

  if (comments.length === 0) {
    return <p className="console-comment-empty">No comments.</p>;
  }

  const isSummaryMode = !showAll && comments.length > 1;

  return (
    <div className="console-comment-list">
      {isSummaryMode && (
        <button
          type="button"
          className="console-comment-show-all"
          onClick={() => {
            setShowAll(true);
            setExpandedKeys(
              (prev) => new Set([...prev, ...comments.map(buildCommentKey)]),
            );
          }}
        >
          Show all {comments.length}
        </button>
      )}
      {comments.map((comment) => {
        const key = buildCommentKey(comment);
        const isExpanded = expandedKeys.has(key);
        return (
          <article
            key={key}
            className={`console-comment${isExpanded ? ' is-expanded' : isSummaryMode ? ' console-comment--expandable' : ''}`}
          >
            <button
              type="button"
              className="console-comment-toggle"
              onClick={() => toggleExpanded(key)}
              aria-expanded={isExpanded}
            >
              <span className="console-comment-author">{comment.author}</span>
              <span className="console-comment-time">
                {formatRelativeTime(comment.createdAt, now)}
              </span>
              {!isExpanded && (
                <span className="console-comment-body-preview">
                  {extractFirstLine(comment.body)}
                </span>
              )}
            </button>
            {onCreateIssueFromComment !== undefined && (
              <button
                type="button"
                className="console-comment-create-workflow-issue"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingComment(comment);
                }}
                title="Create workflow improvement issue from this comment"
              >
                +
              </button>
            )}
            {isExpanded && (
              <ConsoleCommentBodyExpanded
                comment={comment}
                buildImageProxyUrl={buildImageProxyUrl}
                renderReferenceLink={renderReferenceLink}
                repoContext={repoContext}
              />
            )}
          </article>
        );
      })}
      {pendingComment !== null && onCreateIssueFromComment !== undefined && (
        <IssueCreateModalDialog
          storyEntries={storyEntries ?? []}
          agentOptions={agentOptions ?? []}
          onSubmit={onCreateIssueFromComment}
          onClose={() => setPendingComment(null)}
          initialDraft={{
            title: '',
            body: (() => {
              const commentBlockquote = formatAsBlockquote(pendingComment.body);
              if (issueUrl != null && issueTitle != null) {
                return `${issueUrl}\n\n${issueTitle}\n\n\n\n\n\n${commentBlockquote}`;
              }
              if (issueTitle != null) {
                return `${issueTitle}\n\n\n\n\n\n${commentBlockquote}`;
              }
              return commentBlockquote;
            })(),
            storyName: null,
            agentOptionId: null,
          }}
        />
      )}
    </div>
  );
};
