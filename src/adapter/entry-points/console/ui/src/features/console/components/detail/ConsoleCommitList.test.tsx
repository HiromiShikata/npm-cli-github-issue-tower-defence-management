import { render } from '@testing-library/react';
import { consoleCommitsFixture } from '../../testing/fixtures';
import { ConsoleCommitList } from './ConsoleCommitList';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('ConsoleCommitList', () => {
  it('renders the first message line, short sha and author', () => {
    const { getByText } = render(
      <ConsoleCommitList
        commits={consoleCommitsFixture}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(
      getByText('feat(console): add serveConsole subcommand and HTTP server'),
    ).toBeInTheDocument();
    expect(getByText('4f9c2a1')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    const { getByText } = render(
      <ConsoleCommitList commits={[]} isLoading error={null} now={now} />,
    );
    expect(getByText('Loading commits...')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    const { getByText } = render(
      <ConsoleCommitList
        commits={[]}
        isLoading={false}
        error={null}
        now={now}
      />,
    );
    expect(getByText('No commits.')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleCommitList
        commits={[]}
        isLoading={false}
        error="HTTP 500"
        now={now}
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 500');
  });
});
