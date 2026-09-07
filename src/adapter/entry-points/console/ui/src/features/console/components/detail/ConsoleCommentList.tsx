import { useEffect, useRef, useState } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import type { ConsoleRepoContext } from '../../lib/markdown';
import { formatRelativeTime } from '../../logic/relativeTime';
import type { ConsoleComment } from '../../logic/types';
import { buildWorkflowIncidentReportUrl } from '../../logic/workflowIncidentReport';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';

const extractFirstLine = (body: string): string =>
  body.split('\n').find((line) => line.trim() !== '') ?? '';

const buildCommentId = (comment: ConsoleComment): string =>
  `${comment.author}:${comment.createdAt}`;

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
  workflowImprovementIssueUrl?: string | null;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
  repoContext?: ConsoleRepoContext;
};

export const ConsoleCommentList = ({
  comments,
  isLoading,
  error,
  now,
  workflowImprovementIssueUrl = null,
  buildImageProxyUrl,
  renderReferenceLink,
  repoContext,
}: ConsoleCommentListProps) => {
  const lastCommentId =
    comments.length > 0 ? buildCommentId(comments[comments.length - 1]) : null;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    lastCommentId != null ? new Set([lastCommentId]) : new Set(),
  );

  const prevLastCommentIdRef = useRef<string | null>(lastCommentId);

  useEffect(() => {
    if (lastCommentId === null) return;
    if (lastCommentId === prevLastCommentIdRef.current) return;
    prevLastCommentIdRef.current = lastCommentId;
    setExpandedIds(new Set([lastCommentId]));
  }, [lastCommentId]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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

  return (
    <div className="console-comment-list">
      {comments.map((comment) => {
        const id = buildCommentId(comment);
        const isExpanded = expandedIds.has(id);
        return (
          <article
            key={id}
            className={`console-comment${isExpanded ? ' is-expanded' : ''}`}
          >
            <button
              type="button"
              className="console-comment-toggle"
              onClick={() => toggleExpanded(id)}
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
            {workflowImprovementIssueUrl !== null && comment.url !== null && (
              <a
                href={buildWorkflowIncidentReportUrl(
                  workflowImprovementIssueUrl,
                  comment.url,
                )}
                target="_blank"
                rel="noreferrer"
                className="console-comment-report-link"
                aria-label="Create workflow incident report for this comment"
              >
                ⚡
              </a>
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
    </div>
  );
};
