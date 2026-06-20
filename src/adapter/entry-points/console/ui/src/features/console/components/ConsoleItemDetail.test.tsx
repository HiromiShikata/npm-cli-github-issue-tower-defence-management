import { render } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommentsFixture,
  consoleCommitsFixture,
  consoleListItemsFixture,
} from '../fixtures';
import { ConsoleItemDetail } from './ConsoleItemDetail';

jest.mock('../lib/mermaidLoader', () => ({
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
  operationBar: <div>operation-bar</div>,
};

describe('ConsoleItemDetail', () => {
  it('renders the PR title with the PR number, sub bar and changed files panel', () => {
    const { getByText, getAllByText } = render(
      <ConsoleItemDetail item={prItem} {...baseProps} />,
    );
    expect(getAllByText(`PR #${prItem.number}`).length).toBeGreaterThan(0);
    expect(getByText('Changed files')).toBeInTheDocument();
    expect(getByText('Commits')).toBeInTheDocument();
    expect(getByText('operation-bar')).toBeInTheDocument();
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
});
