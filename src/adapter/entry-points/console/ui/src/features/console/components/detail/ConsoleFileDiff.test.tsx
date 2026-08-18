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

  it('renders an image file through the image proxy instead of the placeholder', () => {
    const { getByAltText, queryByText } = render(
      <ConsoleFileDiff
        patch={null}
        path="content/posts/img/20260707/before.jpg"
        rawUrl="https://raw.githubusercontent.com/owner/repo/sha/content/posts/img/20260707/before.jpg"
        buildImageProxyUrl={(src) => `/api/img?url=${encodeURIComponent(src)}`}
      />,
    );
    expect(
      getByAltText('content/posts/img/20260707/before.jpg'),
    ).toHaveAttribute(
      'src',
      `/api/img?url=${encodeURIComponent('https://raw.githubusercontent.com/owner/repo/sha/content/posts/img/20260707/before.jpg')}`,
    );
    expect(queryByText('(no diff / binary or too large)')).toBeNull();
  });

  it('renders an image directly from a data URL without the proxy when rawUrl is a data URI', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { getByAltText, queryByText } = render(
      <ConsoleFileDiff patch={null} path="assets/logo.png" rawUrl={dataUrl} />,
    );
    expect(getByAltText('assets/logo.png')).toHaveAttribute('src', dataUrl);
    expect(queryByText('(no diff / binary or too large)')).toBeNull();
  });

  it('keeps the placeholder for a binary file that is not an image', () => {
    const { getByText } = render(
      <ConsoleFileDiff
        patch={null}
        path="assets/font.woff2"
        rawUrl="https://raw.githubusercontent.com/owner/repo/sha/assets/font.woff2"
        buildImageProxyUrl={(src) => `/api/img?url=${encodeURIComponent(src)}`}
      />,
    );
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
