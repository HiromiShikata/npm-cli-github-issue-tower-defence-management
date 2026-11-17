import { fireEvent, render } from '@testing-library/react';
import { ConsoleStoryDeleteModalDialog } from './ConsoleStoryDeleteModalDialog';

const defaultProps = {
  storyName: 'TDPM Console port',
  isDeleting: false,
  deleteError: null,
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

describe('ConsoleStoryDeleteModalDialog', () => {
  it('renders the dialog with the confirmation prompt', () => {
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} />,
    );
    expect(getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the story name in the prompt', () => {
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} />,
    );
    expect(getByRole('dialog')).toHaveTextContent('TDPM Console port');
  });

  it('does not render a Delete with child tasks button', () => {
    const { queryByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} />,
    );
    expect(
      queryByRole('button', { name: 'Delete with child tasks' }),
    ).toBeNull();
  });

  it('renders only Keep child tasks and Cancel as action buttons', () => {
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} />,
    );
    expect(getByRole('button', { name: 'Keep child tasks' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm with no argument when Keep child tasks is clicked', () => {
    const onConfirm = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} onConfirm={onConfirm} />,
    );
    fireEvent.click(getByRole('button', { name: 'Keep child tasks' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', () => {
    const onCancel = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows Deleting… on the confirm button when isDeleting is true', () => {
    const { getAllByText } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} isDeleting={true} />,
    );
    expect(getAllByText('Deleting…')).toHaveLength(1);
  });

  it('disables all action buttons when isDeleting is true', () => {
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} isDeleting={true} />,
    );
    expect(getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows a delete error alert when deleteError is set', () => {
    const { getByRole } = render(
      <ConsoleStoryDeleteModalDialog
        {...defaultProps}
        deleteError="Delete failed"
      />,
    );
    expect(getByRole('alert')).toHaveTextContent('Delete failed');
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = jest.fn();
    render(
      <ConsoleStoryDeleteModalDialog {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
