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
  { action: 'approve_and_merge', label: 'Approve & Merge', variant: 'approve' },
];

const REJECT_REQUIREMENT_MESSAGE =
  'Reject needs an inline comment on the diff.';

export const ConsolePullRequestReviewActions = ({
  onReview,
  rejectEnabled,
}: ConsolePullRequestReviewGroupProps) => (
  <div className="console-op-group console-op-group-review">
    {!rejectEnabled && (
      <p className="console-op-requirement">{REJECT_REQUIREMENT_MESSAGE}</p>
    )}
    {REVIEW_BUTTONS.map((button) => {
      const disabled = button.action === 'request_changes' && !rejectEnabled;
      return (
        <button
          key={button.action}
          type="button"
          className={`console-op-button console-op-button-${button.variant}`}
          disabled={disabled}
          onClick={() => onReview(button.action)}
        >
          {button.label}
        </button>
      );
    })}
  </div>
);
