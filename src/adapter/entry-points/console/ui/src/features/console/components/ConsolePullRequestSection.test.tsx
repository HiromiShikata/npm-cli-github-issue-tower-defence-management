import { render } from '@testing-library/react';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import { ConsolePullRequestSection } from './ConsolePullRequestSection';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const pullRequest = consoleRelatedPullRequestsFixture[0];

describe('ConsolePullRequestSection', () => {
  it('renders the title, stat bar and changed files', () => {
    const { getByText } = render(
      <ConsolePullRequestSection
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
});
