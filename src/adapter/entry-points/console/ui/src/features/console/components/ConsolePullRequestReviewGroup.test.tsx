import { fireEvent, render } from '@testing-library/react';
import { ConsolePullRequestReviewGroup } from './ConsolePullRequestReviewGroup';

describe('ConsolePullRequestReviewGroup', () => {
  it('renders the four buttons left to right', () => {
    const { getAllByRole } = render(
      <ConsolePullRequestReviewGroup onReview={() => {}} />,
    );
    expect(getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Unnecessary',
      'Totally wrong',
      'Reject',
      'Approve',
    ]);
  });

  it('reports each review action', () => {
    const onReview = jest.fn();
    const { getByText } = render(
      <ConsolePullRequestReviewGroup onReview={onReview} />,
    );
    fireEvent.click(getByText('Unnecessary'));
    fireEvent.click(getByText('Totally wrong'));
    fireEvent.click(getByText('Reject'));
    fireEvent.click(getByText('Approve'));
    expect(onReview.mock.calls.map((call) => call[0])).toEqual([
      'unnecessary',
      'totally_wrong',
      'request_changes',
      'approve',
    ]);
  });
});
