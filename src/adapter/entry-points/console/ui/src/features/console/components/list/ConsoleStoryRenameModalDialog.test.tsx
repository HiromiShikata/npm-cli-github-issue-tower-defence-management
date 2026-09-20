import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleStoryRenameModalDialog } from './ConsoleStoryRenameModalDialog';

const defaultProps = {
  currentName: 'TDPM Console port',
  onSubmit: () => Promise.resolve(),
  onClose: () => undefined,
};

describe('ConsoleStoryRenameModalDialog', () => {
  it('renders the Rename story dialog', () => {
    const { getByRole } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} />,
    );
    expect(getByRole('dialog', { name: 'Rename story' })).toBeInTheDocument();
  });

  it('pre-fills the input with the current story name', () => {
    const { getByPlaceholderText } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} />,
    );
    const input = getByPlaceholderText('Story name') as HTMLInputElement;
    expect(input.value).toBe('TDPM Console port');
  });

  it('calls onSubmit with the new name when Rename is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'Renamed story' },
    });
    fireEvent.click(getByRole('button', { name: 'Rename' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Renamed story'),
    );
  });

  it('calls onClose after a successful rename', async () => {
    const onClose = jest.fn();
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryRenameModalDialog
        {...defaultProps}
        onSubmit={() => Promise.resolve()}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'New name' },
    });
    fireEvent.click(getByRole('button', { name: 'Rename' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows a validation error when Rename is clicked with an empty name', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} />,
    );
    fireEvent.change(getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(getByRole('button', { name: 'Rename' }));
    expect(getByText('Story name is required')).toBeInTheDocument();
  });

  it('shows Renaming… on the submit button while in progress', async () => {
    let resolveRename: () => void;
    const renamePromise = new Promise<void>((resolve) => {
      resolveRename = resolve;
    });
    const onSubmit = jest.fn().mockReturnValue(renamePromise);
    const { getByPlaceholderText, getByText } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'New name' },
    });
    fireEvent.click(getByText('Rename'));
    await waitFor(() => expect(getByText('Renaming…')).toBeInTheDocument());
    await act(async () => {
      resolveRename?.();
    });
  });

  it('shows an API error when onSubmit rejects', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Rename failed'));
    const { getByPlaceholderText, getByRole, findByRole } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'Bad name' },
    });
    fireEvent.click(getByRole('button', { name: 'Rename' }));
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('Rename failed');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryRenameModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
