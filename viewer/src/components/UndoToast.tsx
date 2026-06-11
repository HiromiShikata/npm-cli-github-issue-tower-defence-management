import React from 'react';
import { useEffect, useState } from 'react';
import type { ReviewAction } from '../api/types';

type UndoToastProps = {
  action: ReviewAction;
  prTitle: string;
  onUndo: () => void;
  onExpire: () => void;
};

const ACTION_COLORS: Record<ReviewAction, string> = {
  CLOSE_UNNEEDED: '#9ca3af',
  CLOSE_WRONG: '#ef4444',
  REQUEST_CHANGES: '#f59e0b',
  APPROVE: '#22c55e',
  COMMENT: '#3b82f6',
};

const ACTION_LABELS: Record<ReviewAction, string> = {
  CLOSE_UNNEEDED: 'Unnecessary',
  CLOSE_WRONG: 'Totally wrong',
  REQUEST_CHANGES: 'Reject',
  APPROVE: 'Approve',
  COMMENT: 'Comment',
};

const COUNTDOWN_SECONDS = 5;

export const UndoToast = ({
  action,
  prTitle,
  onUndo,
  onExpire,
}: UndoToastProps): React.JSX.Element => {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire]);

  const color = ACTION_COLORS[action];
  const label = ACTION_LABELS[action];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '1rem',
        background: color,
        color: 'white',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 100,
        maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      <span style={{ fontSize: '0.875rem' }}>
        <strong>{label}</strong>: {prTitle}
      </span>
      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{remaining}s</span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          padding: '0.25rem 0.75rem',
          background: 'rgba(255,255,255,0.25)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Undo
      </button>
    </div>
  );
};
