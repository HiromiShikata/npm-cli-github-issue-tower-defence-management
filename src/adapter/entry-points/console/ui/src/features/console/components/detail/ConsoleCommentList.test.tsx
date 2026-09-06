import { fireEvent, render } from '@testing-library/react';
import { ConsoleCommentList } from './ConsoleCommentList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentList', () => {
  it('auto-expands the latest comment on initial render', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Latest comment\nSecond line',
      createdAt: '2026-06-17T10:00:00.000Z',
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
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
    expect(container.querySelector('.console-comment-body-preview')).toBeNull();
  });

  it('adds is-expanded class to the latest comment article on initial render', () => {
    const comment = {
      author: 'agent',
      body: 'Content',
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
    expect(article?.classList.contains('is-expanded')).toBe(true);
  });

  it('shows first line of non-latest comments and full body of latest in summary mode', () => {
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
    const { getByText, queryByText, container } = render(
      <ConsoleCommentList
        comments={[firstComment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('First line')).toBeInTheDocument();
    expect(queryByText('First detail')).toBeNull();
    const articles = container.querySelectorAll('.console-comment');
    const latestArticle = articles[articles.length - 1];
    expect(
      latestArticle.querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
    expect(
      latestArticle.querySelector('.console-comment-body-preview'),
    ).toBeNull();
    fireEvent.click(getByText('Show all 2'));
    expect(getByText('First line')).toBeInTheDocument();
  });

  it('renders each comment as a single inline line without a separate header block', () => {
    const comment = {
      author: 'reviewer',
      body: 'Hello from agent\nSecond line that should not appear',
      createdAt: '2026-06-17T08:00:00.000Z',
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
    if (!article) throw new Error('article not found');
    const toggleBtn = article.querySelector('.console-comment-toggle');
    if (!toggleBtn) throw new Error('toggle button not found');
    fireEvent.click(toggleBtn);
    expect(container.querySelector('.console-markdown')).toBeNull();
    expect(container.querySelector('.console-comment-header')).toBeNull();
    const authorEl = article.querySelector('.console-comment-author');
    const bodyEl = article.querySelector('.console-comment-body-preview');
    expect(authorEl).not.toBeNull();
    expect(bodyEl).not.toBeNull();
    expect(article.contains(authorEl ?? null)).toBe(true);
    expect(article.contains(bodyEl ?? null)).toBe(true);
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
    const { container, getByText, queryByText } = render(
      <ConsoleCommentList
        comments={[multiLineComment, secondComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(queryByText('Second paragraph detail.')).toBeNull();
    const toggleBtns = container.querySelectorAll('.console-comment-toggle');
    fireEvent.click(toggleBtns[0]);
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
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(
      `/api/img?url=${encodeURIComponent(imageUrl)}`,
    );
    const toggleBtn = container.querySelector('.console-comment-toggle');
    if (!toggleBtn) throw new Error('toggle button not found');
    fireEvent.click(toggleBtn);
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows full comment body when the comment toggle is clicked', () => {
    const comment = {
      author: 'agent',
      body: 'First line of body\nSecond line of body\nThird line',
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
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
    expect(container.querySelector('.console-comment-body-preview')).toBeNull();
    const toggleBtn = container.querySelector('.console-comment-toggle');
    if (!toggleBtn) throw new Error('toggle button not found');
    fireEvent.click(toggleBtn);
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).toBeNull();
    expect(
      container.querySelector('.console-comment-body-preview'),
    ).not.toBeNull();
    expect(
      container.querySelector('.console-comment-body-preview')?.textContent,
    ).toBe('First line of body');
    fireEvent.click(toggleBtn);
    expect(
      container.querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
    expect(container.querySelector('.console-comment-body-preview')).toBeNull();
  });

  it('collapses an expanded comment in summary mode when clicked again', () => {
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
    const { container, queryByText } = render(
      <ConsoleCommentList
        comments={[multiLineComment, secondComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    const toggleBtns = container.querySelectorAll('.console-comment-toggle');
    fireEvent.click(toggleBtns[0]);
    expect(queryByText('Second paragraph detail.')).toBeInTheDocument();
    fireEvent.click(toggleBtns[0]);
    expect(queryByText('Second paragraph detail.')).toBeNull();
  });

  it('reflects expanded state with is-expanded class to drive wrap layout preventing body from being indented by author and time widths', () => {
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
    expect(article.classList.contains('is-expanded')).toBe(true);
    const toggleBtn = article.querySelector('.console-comment-toggle');
    if (!toggleBtn) throw new Error('toggle button not found');
    fireEvent.click(toggleBtn);
    expect(article.classList.contains('is-expanded')).toBe(false);
    fireEvent.click(toggleBtn);
    expect(article.classList.contains('is-expanded')).toBe(true);
  });

  it('resolves same-repo issue references as links when expanded with repoContext', () => {
    const comment = {
      author: 'agent',
      body: 'See #42 for details.',
      createdAt: '2026-09-06T12:00:00.000Z',
      url: null,
    };
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        repoContext={{ owner: 'HiromiShikata', repo: 'secretary' }}
      />,
    );
    const article = container.querySelector('.console-comment');
    expect(article).not.toBeNull();
    if (!article) throw new Error('article not found');
    fireEvent.click(article);
    const link = container.querySelector(
      'a[href="https://github.com/HiromiShikata/secretary/issues/42"]',
    );
    expect(link).not.toBeNull();
  });

  it('uses renderReferenceLink to render custom React nodes for issue references when expanded', () => {
    const comment = {
      author: 'agent',
      body: '[secretary #42](https://github.com/HiromiShikata/secretary/issues/42)',
      createdAt: '2026-09-06T12:00:00.000Z',
      url: null,
    };
    const mockRenderer = (href: string) => (
      <span data-testid="custom-reference" data-href={href} />
    );
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        renderReferenceLink={mockRenderer}
      />,
    );
    const article = container.querySelector('.console-comment');
    expect(article).not.toBeNull();
    if (!article) throw new Error('article not found');
    fireEvent.click(article);
    const ref = container.querySelector('[data-testid="custom-reference"]');
    expect(ref).not.toBeNull();
    expect(ref?.getAttribute('data-href')).toBe(
      'https://github.com/HiromiShikata/secretary/issues/42',
    );
  });
});
