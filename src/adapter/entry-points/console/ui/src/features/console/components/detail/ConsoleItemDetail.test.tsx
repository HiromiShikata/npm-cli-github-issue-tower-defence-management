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
  state: { state: 'open', merged: false, isPullRequest: true, title: '' },
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
  pullRequestStatus: null,
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
        state={{ state: 'open', merged: false, isPullRequest: false, title: '' }}
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

  it('renders failing CI, missing checks, and conflict badges in the PR header', () => {
    const { getByText, container } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: true,
          isPassedAllCiJob: false,
          isCiStateSuccess: false,
          isBranchOutOfDate: true,
          missingRequiredCheckNames: ['build', 'test'],
        }}
      />,
    );
    const title = container.querySelector('.console-detail-title');
    expect(title?.contains(getByText('CI failing'))).toBe(true);
    expect(getByText(/missing: build, test/)).toBeInTheDocument();
    expect(getByText('Conflict')).toBeInTheDocument();
    expect(getByText('Out of date')).toBeInTheDocument();
  });

  it('renders a passing CI badge and no conflict badge when the PR is healthy', () => {
    const { getByText, queryByText } = render(
      <ConsoleItemDetail
        item={prItem}
        {...baseProps}
        pullRequestStatus={{
          found: true,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: [],
        }}
      />,
    );
    expect(getByText('CI passing')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('Out of date')).toBeNull();
  });

  it('does not render PR status badges for an issue item', () => {
    const { queryByText } = render(
      <ConsoleItemDetail
        item={issueItem}
        {...baseProps}
        state={{ state: 'open', merged: false, isPullRequest: false, title: '' }}
        pullRequestStatus={null}
      />,
    );
    expect(queryByText('CI passing')).toBeNull();
    expect(queryByText('CI failing')).toBeNull();
  });
});
