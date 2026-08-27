import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCopyStoryNameButton } from './ConsoleCopyStoryNameButton';

const storyName = 'TDPM Console port';

describe('ConsoleCopyStoryNameButton', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders with text "Copy name"', () => {
    const { getByRole } = render(
      <ConsoleCopyStoryNameButton storyName={storyName} />,
    );
    expect(getByRole('button', { name: 'Copy story name' })).toHaveTextContent(
      'Copy name',
    );
  });

  it('writes the story name to clipboard and changes the accessible label after click', async () => {
    const { getByRole } = render(
      <ConsoleCopyStoryNameButton storyName={storyName} />,
    );
    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Copy story name' }));
    });
    expect(writeText).toHaveBeenCalledWith(storyName);
    await waitFor(() => {
      expect(
        getByRole('button', { name: 'Story name copied to clipboard' }),
      ).toBeInTheDocument();
    });
  });
});
