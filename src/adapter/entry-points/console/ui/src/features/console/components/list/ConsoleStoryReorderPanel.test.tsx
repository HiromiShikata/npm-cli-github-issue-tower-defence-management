import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleFieldOption } from '../../logic/types';
import { ConsoleStoryReorderPanel } from './ConsoleStoryReorderPanel';

const stories: ConsoleFieldOption[] = [
  { id: 'opt-a', name: 'Alpha story', color: 'BLUE' },
  { id: 'opt-b', name: 'Beta story', color: 'GREEN' },
  { id: 'opt-c', name: 'Gamma story', color: 'RED' },
];

describe('ConsoleStoryReorderPanel', () => {
  it('renders story names in the given order', () => {
    const { getAllByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={() => Promise.resolve()}
      />,
    );
    const items = getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Alpha story');
    expect(items[1]).toHaveTextContent('Beta story');
    expect(items[2]).toHaveTextContent('Gamma story');
  });

  it('disables up-button for the first story and down-button for the last story', () => {
    const { getAllByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={() => Promise.resolve()}
      />,
    );
    const upButtons = getAllByRole('button', { name: 'Move up' });
    const downButtons = getAllByRole('button', { name: 'Move down' });
    expect(upButtons[0]).toBeDisabled();
    expect(upButtons[1]).not.toBeDisabled();
    expect(upButtons[2]).not.toBeDisabled();
    expect(downButtons[0]).not.toBeDisabled();
    expect(downButtons[1]).not.toBeDisabled();
    expect(downButtons[2]).toBeDisabled();
  });

  it('calls onReorderStory with storyOptionId and "up" when up-button clicked on a non-first story', async () => {
    const onReorderStory = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={onReorderStory}
      />,
    );
    const upButtons = getAllByRole('button', { name: 'Move up' });
    fireEvent.click(upButtons[1]);
    await waitFor(() => expect(onReorderStory).toHaveBeenCalledTimes(1));
    expect(onReorderStory).toHaveBeenCalledWith('opt-b', 'up');
  });

  it('calls onReorderStory with storyOptionId and "down" when down-button clicked on a non-last story', async () => {
    const onReorderStory = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={onReorderStory}
      />,
    );
    const downButtons = getAllByRole('button', { name: 'Move down' });
    fireEvent.click(downButtons[1]);
    await waitFor(() => expect(onReorderStory).toHaveBeenCalledTimes(1));
    expect(onReorderStory).toHaveBeenCalledWith('opt-b', 'down');
  });

  it('disables both buttons while onReorderStory is in progress', async () => {
    let resolveReorder: () => void;
    const onReorderStory = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReorder = resolve;
        }),
    );
    const { getAllByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={onReorderStory}
      />,
    );
    const downButtons = getAllByRole('button', { name: 'Move down' });
    fireEvent.click(downButtons[1]);
    await waitFor(() => expect(onReorderStory).toHaveBeenCalledTimes(1));
    const upButtonsDuring = getAllByRole('button', { name: 'Move up' });
    const downButtonsDuring = getAllByRole('button', { name: 'Move down' });
    expect(upButtonsDuring[1]).toBeDisabled();
    expect(downButtonsDuring[1]).toBeDisabled();
    resolveReorder?.();
    await waitFor(() => expect(upButtonsDuring[1]).not.toBeDisabled());
  });

  it('shows an error message when onReorderStory rejects', async () => {
    const onReorderStory = jest
      .fn()
      .mockRejectedValue(new Error('server error'));
    const { getAllByRole, getByRole } = render(
      <ConsoleStoryReorderPanel
        stories={stories}
        onReorderStory={onReorderStory}
      />,
    );
    const downButtons = getAllByRole('button', { name: 'Move down' });
    fireEvent.click(downButtons[0]);
    await waitFor(() =>
      expect(getByRole('alert')).toHaveTextContent('server error'),
    );
  });
});
