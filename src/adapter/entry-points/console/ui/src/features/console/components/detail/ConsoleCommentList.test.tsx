import { fireEvent, render } from '@testing-library/react';
import { ConsoleCommentList } from './ConsoleCommentList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentList', () => {
  it('shows only the latest comment until expanded', () => {
    const firstComment = {
      author: 'reviewer',
      body: 'First comment body.',
      createdAt: '2026-06-17T08:00:00.000Z',
      url: null,
    };
    const secondComment = {
      author: 'developer',
      body: 'Second comment body.',
      createdAt: '2026-06-17T09:00:00.000Z',
      url: null,
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest comment body.',
      createdAt: '2026-06-17T10:00:00.000Z',
      url: null,
    };
    const { getByText, queryByText } = render(
      <ConsoleCommentList
        comments={[firstComment, secondComment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(queryByText('First comment body.')).toBeNull();
    expect(queryByText('Second comment body.')).toBeNull();
    expect(getByText('Latest comment body.')).toBeInTheDocument();
    fireEvent.click(getByText('Show all 3'));
    expect(getByText('First comment body.')).toBeInTheDocument();
    expect(getByText('Second comment body.')).toBeInTheDocument();
    expect(getByText('Latest comment body.')).toBeInTheDocument();
  });

  it('renders each comment as a single inline line without a separate header block', () => {
    const comment = {
      author: 'reviewer',
      body: 'Hello from agent\nSecond line that should not appear',
      createdAt: '2026-06-17T08:00:00.000Z',
      url: null,
    };
    const { getByText, container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('Hello from agent')).toBeInTheDocument();
    expect(container.querySelector('.console-markdown')).toBeNull();
    expect(container.querySelector('.console-comment-header')).toBeNull();
    const article = container.querySelector('.console-comment');
    const authorEl = article?.querySelector('.console-comment-author');
    const bodyEl = article?.querySelector('.console-comment-body-preview');
    expect(authorEl).not.toBeNull();
    expect(bodyEl).not.toBeNull();
    expect(article?.contains(authorEl ?? null)).toBe(true);
    expect(article?.contains(bodyEl ?? null)).toBe(true);
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

  it('shows a workflow incident report link for comments with a url when workflowImprovementIssueUrl is set', () => {
    const commentWithUrl = {
      author: 'HiromiShikata',
      body: 'Some comment body.',
      createdAt: '2026-06-19T09:00:00.000Z',
      url: 'https://github.com/owner/repo/issues/1#issuecomment-12345',
    };
    const { getAllByRole } = render(
      <ConsoleCommentList
        comments={[commentWithUrl]}
        isLoading={false}
        error={null}
        now={now}
        workflowImprovementIssueUrl="https://github.com/owner/secretary/issues/new"
      />,
    );
    const links = getAllByRole('link', {
      name: 'Create workflow incident report for this comment',
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining(
        encodeURIComponent(
          'https://github.com/owner/repo/issues/1#issuecomment-12345',
        ),
      ),
    );
  });

  it('does not show a workflow incident report link for comments with null url', () => {
    const commentWithoutUrl = {
      author: 'HiromiShikata',
      body: 'Some comment body.',
      createdAt: '2026-06-19T09:00:00.000Z',
      url: null,
    };
    const { queryByRole } = render(
      <ConsoleCommentList
        comments={[commentWithoutUrl]}
        isLoading={false}
        error={null}
        now={now}
        workflowImprovementIssueUrl="https://github.com/owner/secretary/issues/new"
      />,
    );
    expect(
      queryByRole('link', {
        name: 'Create workflow incident report for this comment',
      }),
    ).toBeNull();
  });

  it('does not show a workflow incident report link when workflowImprovementIssueUrl is not set', () => {
    const commentWithUrl = {
      author: 'HiromiShikata',
      body: 'Some comment body.',
      createdAt: '2026-06-19T09:00:00.000Z',
      url: 'https://github.com/owner/repo/issues/1#issuecomment-12345',
    };
    const { queryByRole } = render(
      <ConsoleCommentList
        comments={[commentWithUrl]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(
      queryByRole('link', {
        name: 'Create workflow incident report for this comment',
      }),
    ).toBeNull();
  });
});
