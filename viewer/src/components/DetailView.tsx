import React, { useState, useEffect } from 'react';
import { MarkdownRendererWithRepo as MarkdownRenderer } from './MarkdownRenderer';
import { DiffView } from './DiffView';
import { ReviewBar } from './ReviewBar';
import type { PrDetailResponse } from '../api/types';
import type { DiffLineComment, ReviewAction } from '../api/types';

type DetailViewProps = {
  detail: PrDetailResponse;
  repo: string;
  onAction: (action: ReviewAction, inlineComments: DiffLineComment[]) => void;
  onBack: () => void;
};

export const DetailView = ({ detail, repo, onAction, onBack }: DetailViewProps): React.JSX.Element => {
  const [inlineComments, setInlineComments] = useState<DiffLineComment[]>([]);

  useEffect(() => {
    setInlineComments([]);
  }, [detail]);

  const handleAddComment = (comment: DiffLineComment): void => {
    setInlineComments((prev) => [...prev, comment]);
  };

  const handleAction = (action: ReviewAction): void => {
    onAction(action, inlineComments);
  };

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto', paddingBottom: '5rem' }}>
      <div style={{ position: 'sticky', top: 0, background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: '0.875rem', padding: '0' }}
        >
          ← Back
        </button>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {detail.issue.title}
        </span>
      </div>

      <div style={{ padding: '1rem' }}>
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#374151' }}>Issue</h2>
          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', lineHeight: 1.6 }}>
            <MarkdownRenderer content={detail.issue.body} repo={repo} />
          </div>
        </section>

        {detail.issue.comments.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#374151' }}>Issue Comments</h2>
            {detail.issue.comments.map((comment, index) => (
              <div key={index} style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  {comment.author} · {new Date(comment.createdAt).toLocaleDateString()}
                </div>
                <MarkdownRenderer content={comment.body} repo={repo} />
              </div>
            ))}
          </section>
        )}

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#374151' }}>Pull Request</h2>
          <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', lineHeight: 1.6 }}>
            <MarkdownRenderer content={detail.pr.body} repo={repo} />
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#374151' }}>
            Changed Files
            {inlineComments.length > 0 && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 400 }}>
                {inlineComments.length} comment{inlineComments.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <DiffView
            files={detail.pr.files}
            headSha={detail.pr.headSha}
            repo={repo}
            inlineComments={inlineComments}
            onAddComment={handleAddComment}
          />
        </section>
      </div>

      <ReviewBar onAction={handleAction} disabled={false} />
    </div>
  );
};
