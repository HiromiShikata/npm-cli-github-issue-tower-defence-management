import { useState } from 'react';
import type { ImageProxyUrlBuilder } from '../../lib/imageProxy';
import { formatRelativeTime } from '../../logic/relativeTime';
import type { ConsoleComment } from '../../logic/types';
import type { ConsoleReferenceLinkRenderer } from '../content/ConsoleMarkdownContent';
import { ConsoleMarkdownContent } from '../content/ConsoleMarkdownContent';

export type ConsoleCommentListProps = {
  comments: ConsoleComment[];
  isLoading: boolean;
  error: string | null;
  now: number;
  buildImageProxyUrl?: ImageProxyUrlBuilder;
  renderReferenceLink?: ConsoleReferenceLinkRenderer;
};

export const ConsoleCommentList = ({
  comments,
  isLoading,
  error,
  now,
  buildImageProxyUrl,
  renderReferenceLink,
}: ConsoleCommentListProps) => {
  const [showAll, setShowAll] = useState<boolean>(false);

  if (error !== null) {
    return (
      <p role="alert" className="console-comment-error">
        Failed to load comments: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="console-comment-loading">Loading comments...</p>;
  }

  if (comments.length === 0) {
    return <p className="console-comment-empty">No comments.</p>;
  }

  const visible = showAll ? comments : comments.slice(-1);

  return (
    <div className="console-comment-list">
      {!showAll && comments.length > 1 && (
        <button
          type="button"
          className="console-comment-show-all"
          onClick={() => setShowAll(true)}
        >
          Show all {comments.length}
        </button>
      )}
      {visible.map((comment) => (
        <article
          key={`${comment.author}:${comment.createdAt}:${comment.body}`}
          className="console-comment"
        >
          <header className="console-comment-header">
            <span className="console-comment-author">{comment.author}</span>
            <span className="console-comment-time">
              {formatRelativeTime(comment.createdAt, now)}
            </span>
          </header>
          <ConsoleMarkdownContent
            body={comment.body}
            buildImageProxyUrl={buildImageProxyUrl}
            renderReferenceLink={renderReferenceLink}
          />
        </article>
      ))}
    </div>
  );
};
