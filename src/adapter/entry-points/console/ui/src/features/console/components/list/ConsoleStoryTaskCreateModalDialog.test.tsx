import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleStoryTaskCreateModalDialog } from './ConsoleStoryTaskCreateModalDialog';

const defaultProps = {
  storyName: 'TDPM Console port',
  onSubmit: () => Promise.resolve(),
  onClose: () => undefined,
};

describe('ConsoleStoryTaskCreateModalDialog', () => {
  it('renders the dialog with the story name in the title', () => {
    const { getByRole } = render(
      <ConsoleStoryTaskCreateModalDialog {...defaultProps} />,
    );
    expect(
      getByRole('dialog', { name: 'Add task to TDPM Console port' }),
    ).toBeInTheDocument();
  });

  it('renders an input with placeholder Issue title', () => {
    const { getByPlaceholderText } = render(
      <ConsoleStoryTaskCreateModalDialog {...defaultProps} />,
    );
    expect(getByPlaceholderText('Issue title')).toBeInTheDocument();
  });

  it('calls onSubmit with storyName and title when Create is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryTaskCreateModalDialog
        {...defaultProps}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'New task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('TDPM Console port', 'New task'),
    );
  });

  it('calls onClose after a successful submit', async () => {
    const onClose = jest.fn();
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryTaskCreateModalDialog
        {...defaultProps}
        onSubmit={() => Promise.resolve()}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'My task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows a validation error when Create is clicked with an empty title', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryTaskCreateModalDialog {...defaultProps} />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(getByText('Title is required')).toBeInTheDocument();
  });

  it('shows an API error when onSubmit rejects', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('API error'));
    const { getByPlaceholderText, getByRole, findByRole } = render(
      <ConsoleStoryTaskCreateModalDialog
        {...defaultProps}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'Bad task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('API error');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryTaskCreateModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryTaskCreateModalDialog {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
