import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCopyUrlButton } from './ConsoleCopyUrlButton';

const url =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/845';

describe('ConsoleCopyUrlButton', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders the default copy label and accessible name', () => {
    const { getByRole } = render(<ConsoleCopyUrlButton url={url} />);
    const button = getByRole('button', { name: 'Copy URL' });
    expect(button).toHaveTextContent('Copy URL');
  });

  it('uses the provided label for the accessible name', () => {
    const { getByRole } = render(
      <ConsoleCopyUrlButton url={url} label="Copy PR URL" />,
    );
    expect(getByRole('button', { name: 'Copy PR URL' })).toBeInTheDocument();
  });

  it('writes the url to the clipboard and shows the copied state on click', async () => {
    const { getByRole, findByText } = render(
      <ConsoleCopyUrlButton url={url} />,
    );
    fireEvent.click(getByRole('button'));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(await findByText('Copied')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'URL copied to clipboard' }),
      ).toBeInTheDocument();
    });
  });

  it('reverts the copied state after the feedback delay', async () => {
    jest.useFakeTimers();
    try {
      const { getByRole, getByText, queryByText } = render(
        <ConsoleCopyUrlButton url={url} />,
      );
      await act(async () => {
        fireEvent.click(getByRole('button'));
      });
      expect(getByText('Copied')).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      expect(queryByText('Copied')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
