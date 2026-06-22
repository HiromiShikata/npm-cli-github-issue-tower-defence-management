import { render } from '@testing-library/react';
import { consoleChangedFilesFixture } from '../../testing/fixtures';
import { ConsoleFileDiff } from './ConsoleFileDiff';

describe('ConsoleFileDiff', () => {
  it('renders added, removed and context lines from the patch', () => {
    const { container } = render(
      <ConsoleFileDiff patch={consoleChangedFilesFixture[0].patch} />,
    );
    const codeText = [...container.querySelectorAll('.console-diff-code')].map(
      (cell) => cell.textContent,
    );
    expect(codeText).toContain('+          npm ci');
    expect(codeText).toContain('-          npm install');
    expect(container.querySelectorAll('.console-diff-add').length).toBe(2);
    expect(container.querySelectorAll('.console-diff-del').length).toBe(1);
    expect(container.querySelectorAll('.console-diff-hunk').length).toBe(1);
  });

  it('shows a placeholder when there is no patch', () => {
    const { getByText } = render(<ConsoleFileDiff patch={null} />);
    expect(getByText('(no diff / binary or too large)')).toBeInTheDocument();
  });
});
