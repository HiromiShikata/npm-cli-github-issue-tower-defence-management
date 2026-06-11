import React from 'react';
import type { ReviewAction } from '../api/types';

type ReviewBarProps = {
  onAction: (action: ReviewAction) => void;
  disabled: boolean;
};

type ActionButton = {
  action: ReviewAction;
  label: string;
  color: string;
  textColor: string;
};

const ACTION_BUTTONS: ActionButton[] = [
  {
    action: 'CLOSE_UNNEEDED',
    label: 'Unnecessary',
    color: '#9ca3af',
    textColor: 'white',
  },
  {
    action: 'CLOSE_WRONG',
    label: 'Totally wrong',
    color: '#ef4444',
    textColor: 'white',
  },
  {
    action: 'REQUEST_CHANGES',
    label: 'Reject',
    color: '#f59e0b',
    textColor: 'white',
  },
  { action: 'APPROVE', label: 'Approve', color: '#22c55e', textColor: 'white' },
];

export const ReviewBar = ({
  onAction,
  disabled,
}: ReviewBarProps): React.JSX.Element => (
  <div
    style={{
      position: 'sticky',
      bottom: 0,
      background: 'white',
      borderTop: '1px solid #e5e7eb',
      padding: '0.75rem 1rem',
      display: 'flex',
      gap: '0.5rem',
      justifyContent: 'flex-end',
      zIndex: 10,
    }}
  >
    {ACTION_BUTTONS.map(({ action, label, color, textColor }) => (
      <button
        key={action}
        type="button"
        onClick={() => onAction(action)}
        disabled={disabled}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: disabled ? '#e5e7eb' : color,
          color: disabled ? '#9ca3af' : textColor,
          border: 'none',
          borderRadius: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);
