import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCopyCodeButton } from './ConsoleCopyCodeButton';

const code = 'const first = 1;\nconst second = first + 1;\n';

describe('ConsoleCopyCodeButton', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders the default copy label and accessible name', () => {
    const { getByRole } = render(<ConsoleCopyCodeButton code={code} />);
    expect(getByRole('button', { name: 'Copy code' })).toHaveTextContent(
      'Copy code',
    );
  });

  it('uses the provided label for the accessible name', () => {
    const { getByRole } = render(
      <ConsoleCopyCodeButton code={code} label="Copy snippet" />,
    );
    expect(getByRole('button', { name: 'Copy snippet' })).toBeInTheDocument();
  });

  it('writes the multi-line code to the clipboard and shows the copied state', async () => {
    const { getByRole, findByText } = render(
      <ConsoleCopyCodeButton code={code} />,
    );
    await act(async () => {
      fireEvent.click(getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledWith(code);
    expect(await findByText('Copied')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Code copied to clipboard' }),
      ).toBeInTheDocument();
    });
  });

  it('reverts the copied state after the feedback delay', async () => {
    jest.useFakeTimers();
    try {
      const { getByRole, getByText, queryByText } = render(
        <ConsoleCopyCodeButton code={code} />,
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
