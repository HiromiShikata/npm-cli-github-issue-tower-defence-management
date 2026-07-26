import { fireEvent, render } from '@testing-library/react';
import { consoleChangedFilesFixture } from '../../testing/fixtures';
import { ConsoleChangedFileList } from './ConsoleChangedFileList';

describe('ConsoleChangedFileList', () => {
  it('renders each file basename, status badge and additions/deletions', () => {
    const { getByText, getAllByText } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(getByText('consoleServer.ts')).toBeInTheDocument();
    expect(getByText('+312')).toBeInTheDocument();
    expect(getAllByText('A').length).toBe(2);
    expect(getByText('M')).toBeInTheDocument();
  });

  it('nests files under their directory nodes as a tree', () => {
    const { container, getByText } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(getByText('adapter')).toBeInTheDocument();
    expect(getByText('console')).toBeInTheDocument();
    expect(getByText('package.json')).toBeInTheDocument();
    const directoryNames = [
      ...container.querySelectorAll('.console-file-tree-dir-name'),
    ].map((node) => node.textContent);
    expect(directoryNames).toContain('📁src');
  });

  it('keeps the diff hidden until the file row is clicked', () => {
    const { container, getByText } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    expect(container.querySelector('.console-file-diff')).toBeNull();
    fireEvent.click(getByText('consoleServer.ts'));
    expect(container.querySelector('.console-file-diff')).toBeInTheDocument();
    const codeText = [...container.querySelectorAll('.console-diff-code')].map(
      (cell) => cell.textContent,
    );
    expect(codeText).toContain('+          npm ci');
  });

  it('collapses the diff again when the file row is clicked twice', () => {
    const { container, getByText } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    const path = getByText('consoleServer.ts');
    fireEvent.click(path);
    expect(container.querySelector('.console-file-diff')).toBeInTheDocument();
    fireEvent.click(path);
    expect(container.querySelector('.console-file-diff')).toBeNull();
  });

  it('marks the expanded file row via aria-expanded', () => {
    const { getAllByRole } = render(
      <ConsoleChangedFileList
        files={consoleChangedFilesFixture}
        isLoading={false}
        error={null}
      />,
    );
    const firstRow = getAllByRole('button')[0];
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(firstRow);
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');
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
