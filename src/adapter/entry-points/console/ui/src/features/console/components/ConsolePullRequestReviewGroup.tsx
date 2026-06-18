import { Button } from '@/components/ui/button';
import type { ConsoleReviewEvent } from '../types';

const REVIEW_BUTTONS: { event: ConsoleReviewEvent; label: string }[] = [
  { event: 'CLOSE_UNNEEDED', label: 'Unnecessary' },
  { event: 'CLOSE_WRONG', label: 'Totally wrong' },
  { event: 'REQUEST_CHANGES', label: 'Reject' },
  { event: 'APPROVE', label: 'Approve' },
];

export type ConsolePullRequestReviewGroupProps = {
  onReview: (event: ConsoleReviewEvent) => void;
};

export const ConsolePullRequestReviewGroup = ({
  onReview,
}: ConsolePullRequestReviewGroupProps) => (
  <div className="flex flex-wrap justify-end gap-2">
    {REVIEW_BUTTONS.map((button) => (
      <Button
        key={button.event}
        type="button"
        size="sm"
        variant={button.event === 'APPROVE' ? 'default' : 'outline'}
        onClick={() => onReview(button.event)}
      >
        {button.label}
      </Button>
    ))}
  </div>
);
