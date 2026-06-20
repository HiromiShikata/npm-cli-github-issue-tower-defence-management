import type { ConsoleReviewAction } from '../../logic/operations';

export type ConsolePullRequestReviewGroupProps = {
  onReview: (action: ConsoleReviewAction) => void;
};

const REVIEW_BUTTONS: {
  action: ConsoleReviewAction;
  label: string;
  color: string;
}[] = [
  { action: 'unnecessary', label: 'Unnecessary', color: '#8b949e' },
  { action: 'totally_wrong', label: 'Totally wrong', color: '#f85149' },
  { action: 'request_changes', label: 'Reject', color: '#d29922' },
  { action: 'approve', label: 'Approve', color: '#3fb950' },
];

export const ConsolePullRequestReviewActions = ({
  onReview,
}: ConsolePullRequestReviewGroupProps) => (
  <div className="console-op-group">
    {REVIEW_BUTTONS.map((button) => (
      <button
        key={button.action}
        type="button"
        className="console-op-button"
        style={{ color: button.color, borderColor: button.color }}
        onClick={() => onReview(button.action)}
      >
        {button.label}
      </button>
    ))}
  </div>
);
