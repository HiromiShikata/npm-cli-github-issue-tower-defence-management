import { fireEvent, render } from '@testing-library/react';
import { ConsoleCommentList } from './ConsoleCommentList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentList', () => {
  it('shows first line of every comment in summary mode with a show-all button to exit', () => {
    const firstComment = {
      author: 'reviewer',
      body: 'First line\nFirst detail',
      createdAt: '2026-06-17T08:00:00.000Z',
      url: null,
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest line\nLatest detail',
      createdAt: '2026-06-17T10:00:00.000Z',
      url: null,
    };
    const { getByText, queryByText } = render(
      <ConsoleCommentList
        comments={[firstComment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('First line')).toBeInTheDocument();
    expect(queryByText('First detail')).toBeNull();
    expect(getByText('Latest line')).toBeInTheDocument();
    expect(queryByText('Latest detail')).toBeNull();
    fireEvent.click(getByText('Show all 2'));
    expect(getByText('First line')).toBeInTheDocument();
    expect(getByText('Latest line')).toBeInTheDocument();
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

  it('expands an individual comment when clicked in summary mode', () => {
    const multiLineComment = {
      author: 'reviewer',
      body: 'First line summary.\n\nSecond paragraph detail.',
      createdAt: '2026-06-17T08:00:00.000Z',
      url: null,
    };
    const secondComment = {
      author: 'HiromiShikata',
      body: 'Acknowledged.',
      createdAt: '2026-06-17T09:00:00.000Z',
      url: null,
    };
    const { getAllByRole, getByText, queryByText } = render(
      <ConsoleCommentList
        comments={[multiLineComment, secondComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(queryByText('Second paragraph detail.')).toBeNull();
    const articles = getAllByRole('article');
    fireEvent.click(articles[0]);
    expect(getByText('Second paragraph detail.')).toBeInTheDocument();
    expect(getByText('Acknowledged.')).toBeInTheDocument();
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

  it('renders an image from markdown in the comment body when the comment is expanded', () => {
    const imageUrl =
      'https://github.com/user-attachments/assets/1f363cda-b9e6-4e59-b3d6-6343a7fa4554';
    const comment = {
      author: 'HiromiShikata',
      body: `Screenshot attached:\n![Image](${imageUrl})`,
      createdAt: '2026-09-06T12:00:00.000Z',
      url: null,
    };
    const buildProxyUrl = (src: string) =>
      `/api/img?url=${encodeURIComponent(src)}`;
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        buildImageProxyUrl={buildProxyUrl}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    const article = container.querySelector('.console-comment');
    expect(article).not.toBeNull();
    if (!article) throw new Error('article not found');
    fireEvent.click(article);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(
      `/api/img?url=${encodeURIComponent(imageUrl)}`,
    );
  });

  it('shows full comment body when the comment article is clicked', () => {
    const comment = {
      author: 'agent',
      body: 'First line of body\nSecond line of body\nThird line',
      createdAt: '2026-09-01T10:00:00.000Z',
      url: null,
    };
    const { container, getByText } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('First line of body')).toBeInTheDocument();
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).toBeNull();
    const article = container.querySelector('.console-comment');
    expect(article).not.toBeNull();
    if (!article) throw new Error('article not found');
    fireEvent.click(article);
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
    const expanded = container.querySelector('.console-comment-body-expanded');
    expect(expanded?.textContent).toContain('Second line of body');
    fireEvent.click(article);
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).toBeNull();
  });

  it('sets data-expanded on the article to drive wrap layout that prevents the body from being indented by author and time widths', () => {
    const comment = {
      author: 'agent',
      body: 'First line\nSecond line\nThird line',
      createdAt: '2026-09-01T10:00:00.000Z',
      url: null,
    };
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    const article = container.querySelector('.console-comment');
    expect(article).not.toBeNull();
    if (!article) throw new Error('article not found');
    expect(article.getAttribute('data-expanded')).toBe('false');
    fireEvent.click(article);
    expect(article.getAttribute('data-expanded')).toBe('true');
    fireEvent.click(article);
    expect(article.getAttribute('data-expanded')).toBe('false');
  });
});
