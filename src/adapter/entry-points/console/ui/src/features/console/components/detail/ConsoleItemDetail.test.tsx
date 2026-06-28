import { render } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
} from '../../testing/fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

const baseProps = {
  storyName: 'TDPM Console port',
  storyColorEnum: 'BLUE' as const,
  overlayStatus: null,
  state: { state: 'open', merged: false, isPullRequest: true },
  body: '## Body heading',
  bodyIsLoading: false,
  bodyError: null,
  comments: consoleCommentsFixture,
  commentsAreLoading: false,
  commentsError: null,
  files: consoleChangedFilesFixture,
  filesAreLoading: false,
  filesError: null,
  commits: consoleCommitsFixture,
  commitsAreLoading: false,
  commitsError: null,
  relatedPullRequests: [],
  now,
  commentComposer: <div>comment-composer</div>,
  operationBar: <div>operation-bar</div>,
};

describe('ConsoleItemDetail', () => {
  it('renders the PR title with the PR number, sub bar and counted panels', () => {
    const { getByText, getAllByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getAllByText(`PR #${prItem.number}`).length).toBeGreaterThan(0);
    expect(
      getByText(`Changed files (${consoleChangedFilesFixture.length})`),
    ).toBeInTheDocument();
    expect(
      getByText(`Comments (${consoleCommentsFixture.length})`),
    ).toBeInTheDocument();
    expect(
      getByText(`Commits (${consoleCommitsFixture.length})`),
    ).toBeInTheDocument();
    expect(getByText('operation-bar')).toBeInTheDocument();
    expect(getByText('comment-composer')).toBeInTheDocument();
  });

  it('renders the Description open link to the item url', () => {
    const { getByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    const openLink = getByText('open');
    expect(openLink).toHaveAttribute('href', prItem.url);
  });

  it('renders the story tag and opened relative time', () => {
    const { getByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText(/opened/)).toBeInTheDocument();
  });

  it('renders an issue without the changed files or commits panels', () => {
    const { queryByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{ state: 'open', merged: false, isPullRequest: false }}
      />,
    );
    expect(queryByText('Changed files')).toBeNull();
    expect(queryByText('Commits')).toBeNull();
  });

  it('renders a copy URL button for the item url in the sub bar', () => {
    const { getByRole } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getByRole('button', { name: 'Copy URL' })).toBeInTheDocument();
  });

  it('renders the overlay status chip when set', () => {
    const { getByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
      />,
    );
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
  });

  it('renders the overlay status chip inside the title header', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        overlayStatus={{ name: 'Awaiting Workspace', color: 'BLUE' }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    expect(title).not.toBeNull();
    expect(title?.contains(getByText('Awaiting Workspace'))).toBe(true);
  });
});
