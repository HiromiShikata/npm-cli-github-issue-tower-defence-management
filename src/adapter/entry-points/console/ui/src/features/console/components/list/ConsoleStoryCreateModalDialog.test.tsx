import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleStoryCreateModalDialog } from './ConsoleStoryCreateModalDialog';

const defaultProps = {
  onSubmit: () => Promise.resolve(),
  onClose: () => undefined,
};

describe('ConsoleStoryCreateModalDialog', () => {
  it('renders the Add story dialog', () => {
    const { getByRole } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} />,
    );
    expect(getByRole('dialog', { name: 'Add story' })).toBeInTheDocument();
  });

  it('renders an input with placeholder Story name', () => {
    const { getByPlaceholderText } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} />,
    );
    expect(getByPlaceholderText('Story name')).toBeInTheDocument();
  });

  it('calls onSubmit with the story name when Create is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'My new story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('My new story'));
  });

  it('calls onClose after a successful submit', async () => {
    const onClose = jest.fn();
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryCreateModalDialog
        {...defaultProps}
        onSubmit={() => Promise.resolve()}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'My story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows a validation error when Create is clicked with an empty name', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(getByText('Story name is required')).toBeInTheDocument();
  });

  it('shows an API error when onSubmit rejects', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('API failure'));
    const { getByPlaceholderText, getByRole, findByRole } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'Bad story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('API failure');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryCreateModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = jest.fn();
    render(
      <ConsoleStoryCreateModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
