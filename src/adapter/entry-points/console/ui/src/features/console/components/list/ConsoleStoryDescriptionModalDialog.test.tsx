import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleStoryDescriptionModalDialog } from './ConsoleStoryDescriptionModalDialog';

const defaultProps = {
  currentDescription: '',
  onSubmit: () => Promise.resolve(),
  onClose: () => undefined,
};

describe('ConsoleStoryDescriptionModalDialog', () => {
  it('renders the Edit story description dialog', () => {
    const { getByRole } = render(
      <ConsoleStoryDescriptionModalDialog {...defaultProps} />,
    );
    expect(
      getByRole('dialog', { name: 'Edit story description' }),
    ).toBeInTheDocument();
  });

  it('renders a textarea with placeholder Story description', () => {
    const { getByPlaceholderText } = render(
      <ConsoleStoryDescriptionModalDialog {...defaultProps} />,
    );
    expect(getByPlaceholderText('Story description')).toBeInTheDocument();
  });

  it('pre-fills the textarea with the current description', () => {
    const { getByPlaceholderText } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        currentDescription="Existing description"
      />,
    );
    const textarea = getByPlaceholderText(
      'Story description',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Existing description');
  });

  it('calls onSubmit with the new description when Save is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(getByPlaceholderText('Story description'), {
      target: { value: 'New description' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('New description'),
    );
  });

  it('allows saving an empty description', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        currentDescription="Some text"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(getByPlaceholderText('Story description'), {
      target: { value: '' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(''));
  });

  it('calls onClose after a successful save', async () => {
    const onClose = jest.fn();
    const { getByPlaceholderText, getByRole } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        onSubmit={() => Promise.resolve()}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByPlaceholderText('Story description'), {
      target: { value: 'Some description' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryDescriptionModalDialog
        {...defaultProps}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
