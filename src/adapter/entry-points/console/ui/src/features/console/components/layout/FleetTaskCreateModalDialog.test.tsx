import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { FleetTaskCreateModalDialog } from './FleetTaskCreateModalDialog';

describe('FleetTaskCreateModalDialog', () => {
  it('renders a title input', () => {
    const { getByRole } = render(
      <FleetTaskCreateModalDialog
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onClose={jest.fn()}
      />,
    );
    expect(getByRole('textbox', { name: /title/i })).toBeInTheDocument();
  });

  it('calls onSubmit with the entered title when Create is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByRole } = render(
      <FleetTaskCreateModalDialog onSubmit={onSubmit} onClose={onClose} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My fleet task title' },
    });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^create$/i }));
    });
    expect(onSubmit).toHaveBeenCalledWith('My fleet task title');
  });

  it('calls onClose after successful submit', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByRole } = render(
      <FleetTaskCreateModalDialog onSubmit={onSubmit} onClose={onClose} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Fleet task' },
    });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^create$/i }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <FleetTaskCreateModalDialog
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <FleetTaskCreateModalDialog
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <FleetTaskCreateModalDialog
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables buttons while submitting', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { getByRole } = render(
      <FleetTaskCreateModalDialog onSubmit={onSubmit} onClose={jest.fn()} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'In-progress task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => {
      expect(getByRole('button', { name: /creating/i })).toBeDisabled();
    });
    expect(getByRole('button', { name: /cancel/i })).toBeDisabled();
    act(() => resolveSubmit());
  });

  it('shows an error message when onSubmit throws', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValue(new Error('Network failure'));
    const { getByRole, getByText } = render(
      <FleetTaskCreateModalDialog onSubmit={onSubmit} onClose={jest.fn()} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Failing task' },
    });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^create$/i }));
    });
    expect(getByText('Network failure')).toBeInTheDocument();
  });

  it('shows a required error when title is empty', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, getByText } = render(
      <FleetTaskCreateModalDialog onSubmit={onSubmit} onClose={jest.fn()} />,
    );
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^create$/i }));
    });
    expect(getByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
