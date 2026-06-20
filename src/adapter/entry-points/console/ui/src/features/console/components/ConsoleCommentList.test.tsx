import { fireEvent, render } from '@testing-library/react';
import { consoleCommentsFixture } from '../fixtures';
import { ConsoleCommentList } from './ConsoleCommentList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentList', () => {
  it('shows only the latest comment until expanded', () => {
    const { getByText, queryByText } = render(
      <ConsoleCommentList
        comments={consoleCommentsFixture}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(
      getByText(/Looks good now\. Approving once the rebase is green\./),
    ).toBeInTheDocument();
    expect(queryByText(/Please split the token validation/)).toBeNull();
    fireEvent.click(getByText('Show all 3'));
    expect(getByText(/Please split the token validation/)).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    const { getByText } = render(
      <ConsoleCommentList comments={[]} isLoading error={null} now={now} />,
    );
    expect(getByText('Loading comments...')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    const { getByText } = render(
      <ConsoleCommentList
        comments={[]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('No comments.')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleCommentList
        comments={[]}
        isLoading={false}
        error="HTTP 500"
        now={now}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 500');
  });
});
