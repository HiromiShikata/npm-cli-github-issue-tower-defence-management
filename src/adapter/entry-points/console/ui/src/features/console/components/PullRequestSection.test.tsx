import { render, screen } from '@testing-library/react';
import {
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import { PullRequestSection } from './PullRequestSection';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg></svg>' })),
  },
}));

describe('PullRequestSection', () => {
  it('renders related pull requests, changed files, and commits', () => {
    render(
      <PullRequestSection
        detail={consolePullRequestDetailFixture}
        relatedPullRequests={consoleRelatedPullRequestsFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getByText('Related pull requests (1)')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Changed files (${consolePullRequestDetailFixture.files.length})`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Commits (${consolePullRequestDetailFixture.commits.length})`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('src/adapter/entry-points/console/consoleServer.ts'),
    ).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    render(
      <PullRequestSection
        detail={null}
        relatedPullRequests={[]}
        isLoading
        error={null}
      />,
    );
    expect(
      screen.getByText('Loading pull request details…'),
    ).toBeInTheDocument();
  });

  it('renders nothing when there is no detail and no error', () => {
    const { container } = render(
      <PullRequestSection
        detail={null}
        relatedPullRequests={[]}
        isLoading={false}
        error={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the error state', () => {
    render(
      <PullRequestSection
        detail={null}
        relatedPullRequests={[]}
        isLoading={false}
        error="HTTP 502"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 502');
  });
});
