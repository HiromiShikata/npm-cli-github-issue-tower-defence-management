import { useEffect, useState } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import type { ConsoleRepoContext } from '../../lib/markdown';
import { formatRelativeTime } from '../../logic/relativeTime';
import type { ConsoleComment } from '../../logic/types';
import { buildWorkflowIncidentReportUrl } from '../../logic/workflowIncidentReport';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';

const extractFirstLine = (body: string): string =>
  body.split('\n').find((line) => line.trim() !== '') ?? '';

const buildCommentKey = (comment: ConsoleComment): string =>
  `${comment.author}:${comment.createdAt}:${comment.body}`;

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
  const [showAll, setShowAll] = useState<boolean>(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const latestKey =
    comments.length > 0 ? buildCommentKey(comments[comments.length - 1]) : null;

  useEffect(() => {
    if (latestKey === null) return;
    setExpandedKeys((prev) => new Set([...prev, latestKey]));
  }, [latestKey]);

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
          onClick={() => setShowAll(true)}
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
            onClick={() => toggleExpanded(key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                toggleExpanded(key);
              }
            }}
          >
            <span className="console-comment-author">{comment.author}</span>
            <span className="console-comment-time">
              {formatRelativeTime(comment.createdAt, now)}
            </span>
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
            {!isExpanded && (
              <span className="console-comment-body-preview">
                {extractFirstLine(comment.body)}
              </span>
            )}
            {isExpanded && (
              <div className="console-comment-body-expanded">
                <ConsoleMarkdownContent
                  body={comment.body}
                  buildImageProxyUrl={buildImageProxyUrl}
                  renderReferenceLink={renderReferenceLink}
                  repoContext={repoContext}
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
