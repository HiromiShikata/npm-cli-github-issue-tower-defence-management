import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCommentList } from './ConsoleCommentList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommentList', () => {
  it('auto-expands the latest comment on initial render', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Latest comment\nSecond line',
      createdAt: '2026-06-17T10:00:00.000Z',
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
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest line\nLatest detail',
      createdAt: '2026-06-17T10:00:00.000Z',
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
    const articlesAfterShowAll = container.querySelectorAll('.console-comment');
    expect(
      articlesAfterShowAll[0].querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
  });

  it('expands all comments when Show all is clicked', () => {
    const firstComment = {
      author: 'reviewer',
      body: 'First line summary\nFirst detail body',
      createdAt: '2026-06-17T08:00:00.000Z',
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest comment body',
      createdAt: '2026-06-17T10:00:00.000Z',
    };
    const { getByText, container } = render(
      <ConsoleCommentList
        comments={[firstComment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    const articles = container.querySelectorAll('.console-comment');
    expect(
      articles[0].querySelector('.console-comment-body-expanded'),
    ).toBeNull();
    fireEvent.click(getByText('Show all 2'));
    const articlesAfter = container.querySelectorAll('.console-comment');
    expect(
      articlesAfter[0].querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
  });

  it('renders each comment as a single inline line without a separate header block', () => {
    const comment = {
      author: 'reviewer',
      body: 'Hello from agent\nSecond line that should not appear',
      createdAt: '2026-06-17T08:00:00.000Z',
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
    };
    const secondComment = {
      author: 'HiromiShikata',
      body: 'Acknowledged.',
      createdAt: '2026-06-17T09:00:00.000Z',
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

  it('renders an image from markdown in the comment body when the comment is expanded', () => {
    const imageUrl =
      'https://github.com/user-attachments/assets/1f363cda-b9e6-4e59-b3d6-6343a7fa4554';
    const comment = {
      author: 'HiromiShikata',
      body: `Screenshot attached:\n![Image](${imageUrl})`,
      createdAt: '2026-09-06T12:00:00.000Z',
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
    };
    const secondComment = {
      author: 'HiromiShikata',
      body: 'Acknowledged.',
      createdAt: '2026-06-17T09:00:00.000Z',
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

  it('restores expanded state from localStorage when persistenceKey is provided', () => {
    const persistenceKey = 'https://github.com/owner/repo/issues/1';
    const firstComment = {
      author: 'reviewer',
      body: 'First line\nSecond line',
      createdAt: '2026-06-17T08:00:00.000Z',
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest comment',
      createdAt: '2026-06-17T10:00:00.000Z',
    };
    const firstKey = `${firstComment.author}:${firstComment.createdAt}:${firstComment.body}`;
    localStorage.setItem(
      `console-comment-expanded:${persistenceKey}`,
      JSON.stringify([firstKey]),
    );
    const { container } = render(
      <ConsoleCommentList
        comments={[firstComment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
        persistenceKey={persistenceKey}
      />,
    );
    const articles = container.querySelectorAll('.console-comment');
    expect(articles[0].classList.contains('is-expanded')).toBe(true);
    expect(
      articles[0].querySelector('.console-comment-body-expanded'),
    ).not.toBeNull();
  });

  it('saves expanded state to localStorage when persistenceKey is provided', () => {
    const persistenceKey = 'https://github.com/owner/repo/issues/2';
    const comment = {
      author: 'reviewer',
      body: 'A comment body',
      createdAt: '2026-06-17T08:00:00.000Z',
    };
    const latestComment = {
      author: 'HiromiShikata',
      body: 'Latest',
      createdAt: '2026-06-17T10:00:00.000Z',
    };
    const { container } = render(
      <ConsoleCommentList
        comments={[comment, latestComment]}
        isLoading={false}
        error={null}
        now={now}
        persistenceKey={persistenceKey}
      />,
    );
    const toggleBtns = container.querySelectorAll('.console-comment-toggle');
    fireEvent.click(toggleBtns[0]);
    const stored = localStorage.getItem(
      `console-comment-expanded:${persistenceKey}`,
    );
    expect(stored).not.toBeNull();
    if (stored === null) throw new Error('stored should not be null');
    const parsed = JSON.parse(stored);
    const commentKey = `${comment.author}:${comment.createdAt}:${comment.body}`;
    expect(parsed).toContain(commentKey);
  });

  it('does not touch localStorage when persistenceKey is not provided', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Content',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    localStorage.clear();
    render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(localStorage.length).toBe(0);
  });

  it('renders a create workflow issue button for each comment when onCreateIssueFromComment is provided', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const onCreateIssueFromComment = jest.fn();
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    expect(btn).not.toBeNull();
  });

  it('does not render a create workflow issue button when onCreateIssueFromComment is not provided', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
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
      container.querySelector('.console-comment-create-workflow-issue'),
    ).toBeNull();
  });

  it('calls onCreateIssueFromComment with comment body as blockquote when the dialog Create button is clicked', async () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const onCreateIssueFromComment = jest.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByLabelText } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        issueUrl="https://github.com/owner/repo/issues/1"
        issueTitle="Source issue title"
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    fireEvent.change(getByLabelText('Title'), {
      target: { value: 'New task from comment' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onCreateIssueFromComment).toHaveBeenCalledWith({
        title: 'New task from comment',
        body: 'https://github.com/owner/repo/issues/1\n\nSource issue title\n\n\n\n\n\n> Please split the token validation into its own tested function.',
        storyName: null,
        agentOptionId: null,
        files: [],
      });
    });
  });

  it('pre-populates dialog with empty title and comment body as blockquote prefixed by issue url and title', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'First line\nSecond line',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const { container, getByRole } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        issueUrl="https://github.com/owner/repo/issues/1"
        issueTitle="My issue title"
        onCreateIssueFromComment={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    const titleTextarea = getByRole('textbox', { name: 'Title' });
    const bodyTextarea = getByRole('textbox', { name: 'Body' });
    expect((titleTextarea as HTMLTextAreaElement).value).toBe('');
    expect((bodyTextarea as HTMLTextAreaElement).value).toBe(
      'https://github.com/owner/repo/issues/1\n\nMy issue title\n\n\n\n\n\n> First line\n> Second line',
    );
  });

  it('pre-populates dialog body with only comment blockquote when no issueUrl or issueTitle is provided', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'A comment body',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const { container, getByRole } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        onCreateIssueFromComment={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    const bodyTextarea = getByRole('textbox', { name: 'Body' });
    expect((bodyTextarea as HTMLTextAreaElement).value).toBe('> A comment body');
  });

  it('disables the dialog submit button while onCreateIssueFromComment is in progress', async () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'A comment body',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    let resolveSubmit!: () => void;
    const onCreateIssueFromComment = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const { container, getByRole, getByLabelText } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    fireEvent.change(getByLabelText('Title'), {
      target: { value: 'Task title' },
    });
    const createBtn = getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(createBtn).toBeDisabled();
    });
    resolveSubmit();
  });

  it('shows error in the dialog when onCreateIssueFromComment rejects', async () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'A comment body',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const onCreateIssueFromComment = jest
      .fn()
      .mockRejectedValue(new Error('Server error'));
    const { container, getByRole, getByText, getByLabelText } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    fireEvent.change(getByLabelText('Title'), {
      target: { value: 'Task title' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(getByText('Server error')).toBeInTheDocument();
    });
  });

  it('opens a dialog when the create workflow issue button is clicked instead of calling the callback directly', () => {
    const comment = {
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const onCreateIssueFromComment = jest.fn();
    const { container, queryByRole } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    expect(onCreateIssueFromComment).not.toHaveBeenCalled();
    expect(queryByRole('dialog')).not.toBeNull();
  });

  it('does not propagate click events from the expanded body to ancestor elements', () => {
    const comment = {
      author: 'agent',
      body: 'First line\nSecond line visible only when expanded',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    const { container } = render(
      <ConsoleCommentList
        comments={[comment]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    const body = container.querySelector('.console-comment-body-expanded');
    if (!body) throw new Error('body not found');
    let clickReachedDocument = false;
    const handler = () => {
      clickReachedDocument = true;
    };
    document.addEventListener('click', handler);
    try {
      fireEvent.click(body);
      expect(clickReachedDocument).toBe(false);
    } finally {
      document.removeEventListener('click', handler);
    }
  });
});
