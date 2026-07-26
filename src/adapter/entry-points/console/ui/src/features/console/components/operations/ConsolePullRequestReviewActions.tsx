import type { ConsoleReviewAction } from '../../logic/operations';

export type ConsolePullRequestReviewGroupProps = {
  onReview: (action: ConsoleReviewAction) => void;
  rejectEnabled: boolean;
};

const REVIEW_BUTTONS: {
  action: ConsoleReviewAction;
  label: string;
  variant: string;
}[] = [
  { action: 'unnecessary', label: 'Unnecessary', variant: 'unneeded' },
  { action: 'totally_wrong', label: 'Totally wrong', variant: 'wrong' },
  { action: 'request_changes', label: 'Reject', variant: 'reject' },
  { action: 'approve', label: 'Approve', variant: 'approve' },
];

export const ConsolePullRequestReviewActions = ({
  onReview,
  rejectEnabled,
}: ConsolePullRequestReviewGroupProps) => (
  <div className="console-op-group console-op-group-review">
    {REVIEW_BUTTONS.map((button) => {
      const disabled = button.action === 'request_changes' && !rejectEnabled;
      return (
        <button
          key={button.action}
          type="button"
          className={`console-op-button console-op-button-${button.variant}`}
          disabled={disabled}
          title={
            disabled
              ? 'Enter an inline comment on the diff to enable Reject'
              : undefined
          }
          onClick={() => onReview(button.action)}
        >
          {button.label}
        </button>
      );
    })}
  </div>
);
