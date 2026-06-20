import { render } from '@testing-library/react';
import { consoleChangedFilesFixture } from '../../testing/fixtures';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';

describe('ConsoleChangedFileList', () => {
  it('renders each file path, status badge and additions/deletions', () => {
    const { getByText, getAllByText } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(
      getByText('src/adapter/entry-points/console/consoleServer.ts'),
    ).toBeInTheDocument();
    expect(getByText('+312')).toBeInTheDocument();
    expect(getAllByText('A').length).toBe(2);
    expect(getByText('M')).toBeInTheDocument();
  });

  it('shows the loading state', () => {
    const { getByText } = render(
      <ConsoleChangedFileList files={[]} isLoading error={null} />,
    );
    expect(getByText('Loading changed files...')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    const { getByText } = render(
      <ConsoleChangedFileList files={[]} isLoading={false} error={null} />,
    );
    expect(getByText('No changed files.')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    const { getByRole } = render(
      <ConsoleChangedFileList files={[]} isLoading={false} error="HTTP 502" />,
    );
    expect(getByRole('alert')).toHaveTextContent('HTTP 502');
  });
});
