import { render } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const pullRequest = consoleRelatedPullRequestsFixture[0];

describe('ConsolePullRequestDetail', () => {
  it('renders the title, stat bar and changed files', () => {
    const { getByText } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(
      getByText(
        'Scaffold React console UI under entry-points with build bundling',
      ),
    ).toBeInTheDocument();
    expect(getByText('+1184')).toBeInTheDocument();
    expect(getByText('27 files')).toBeInTheDocument();
  });

  it('renders a copy URL button for the pull request url', () => {
    const { getByRole } = render(
      <ConsolePullRequestDetail
        pullRequest={pullRequest}
        body={pullRequest.summary?.body ?? ''}
        bodyIsLoading={false}
        files={consoleChangedFilesFixture}
        filesAreLoading={false}
        filesError={null}
        commits={consoleCommitsFixture}
        commitsAreLoading={false}
        commitsError={null}
        now={now}
      />,
    );
    expect(getByRole('button', { name: 'Copy PR URL' })).toBeInTheDocument();
  });
});
