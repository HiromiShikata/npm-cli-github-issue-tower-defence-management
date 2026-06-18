import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ConsoleComment } from '../types';
import { MarkdownView } from './MarkdownView';

export type ConsoleCommentListProps = {
  comments: ConsoleComment[];
  isLoading: boolean;
  error: string | null;
};

const formatCommentMeta = (comment: ConsoleComment): string =>
  `${comment.author} · ${new Date(comment.createdAt).toISOString()}`;

export const ConsoleCommentList = ({
  comments,
  isLoading,
  error,
}: ConsoleCommentListProps) => {
  const [showAll, setShowAll] = useState(false);

  if (error !== null) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load comments: {error}
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading comments…</p>;
  }

  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">(no comments)</p>;
  }

  const visibleComments = showAll ? comments : comments.slice(-1);

  return (
    <div className="flex flex-col gap-3">
      {comments.length > 1 && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll
              ? 'Show latest only'
              : `Show all ${comments.length} comments`}
          </Button>
          {!showAll && (
            <span className="text-xs text-muted-foreground">
              Showing latest comment only (of {comments.length})
            </span>
          )}
        </div>
      )}
      {visibleComments.map((comment) => (
        <article
          key={`${comment.author}-${comment.createdAt}`}
          className="rounded-md border border-border p-3"
        >
          <header className="mb-2 text-xs text-muted-foreground">
            {formatCommentMeta(comment)}
          </header>
          <MarkdownView source={comment.body} emptyText="(empty comment)" />
        </article>
      ))}
    </div>
  );
};
