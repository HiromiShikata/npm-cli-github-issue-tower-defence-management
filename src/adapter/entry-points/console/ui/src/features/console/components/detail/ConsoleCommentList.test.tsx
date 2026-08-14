import { fireEvent, render } from '@testing-library/react';
import { consoleCommentsFixture } from '../../testing/fixtures';
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

  it('reports a failed read as not loaded, leaving the alert to the detail', () => {
    const { getByText, queryByRole, queryByText } = render(
      <ConsoleCommentList
        comments={[]}
        isLoading={false}
        error="HTTP 500"
        now={now}
      />,
    );
    expect(getByText('Not loaded.')).toBeInTheDocument();
    expect(queryByText('No comments.')).toBeNull();
    expect(queryByRole('alert')).toBeNull();
  });
});
