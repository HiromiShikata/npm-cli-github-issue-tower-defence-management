import { fireEvent, render, waitFor } from '@testing-library/react';
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

  it('does not render any comment affordance without an onAddInlineComment handler', () => {
    const { container } = render(
      <ConsoleFileDiff
        patch={consoleChangedFilesFixture[0].patch}
        path="src/adapter/entry-points/console/consoleServer.ts"
      />,
    );
    expect(
      container.querySelectorAll('.console-diff-comment-button').length,
    ).toBe(0);
  });

  it('anchors an added line comment to its new line on the RIGHT side', async () => {
    const onAddInlineComment = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ConsoleFileDiff
        patch={consoleChangedFilesFixture[0].patch}
        path="src/adapter/entry-points/console/consoleServer.ts"
        onAddInlineComment={onAddInlineComment}
      />,
    );
    fireEvent.click(getByLabelText('Comment on line 57 (RIGHT)'));
    fireEvent.change(
      getByPlaceholderText('Leave a review comment on this line…'),
      { target: { value: 'Why npm ci here?' } },
    );
    fireEvent.click(getByText('Comment'));
    await waitFor(() =>
      expect(onAddInlineComment).toHaveBeenCalledWith(
        'src/adapter/entry-points/console/consoleServer.ts',
        57,
        'RIGHT',
        'Why npm ci here?',
      ),
    );
  });

  it('anchors a removed line comment to its old line on the LEFT side', async () => {
    const onAddInlineComment = jest.fn().mockResolvedValue(undefined);
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <ConsoleFileDiff
        patch={consoleChangedFilesFixture[0].patch}
        path="src/adapter/entry-points/console/consoleServer.ts"
        onAddInlineComment={onAddInlineComment}
      />,
    );
    fireEvent.click(getByLabelText('Comment on line 57 (LEFT)'));
    fireEvent.change(
      getByPlaceholderText('Leave a review comment on this line…'),
      { target: { value: 'Keep npm install?' } },
    );
    fireEvent.click(getByText('Comment'));
    await waitFor(() =>
      expect(onAddInlineComment).toHaveBeenCalledWith(
        'src/adapter/entry-points/console/consoleServer.ts',
        57,
        'LEFT',
        'Keep npm install?',
      ),
    );
  });

  it('shows the surfaced error when posting an inline comment fails', async () => {
    const onAddInlineComment = jest
      .fn()
      .mockRejectedValue(new Error('line must be part of the diff'));
    const { getByLabelText, getByPlaceholderText, getByText, getByRole } =
      render(
        <ConsoleFileDiff
          patch={consoleChangedFilesFixture[0].patch}
          path="src/adapter/entry-points/console/consoleServer.ts"
          onAddInlineComment={onAddInlineComment}
        />,
      );
    fireEvent.click(getByLabelText('Comment on line 58 (RIGHT)'));
    fireEvent.change(
      getByPlaceholderText('Leave a review comment on this line…'),
      { target: { value: 'A comment that will fail.' } },
    );
    fireEvent.click(getByText('Comment'));
    await waitFor(() =>
      expect(getByRole('alert')).toHaveTextContent(
        'line must be part of the diff',
      ),
    );
  });
});
