import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleWorkflowIssueCreateModalDialog } from './ConsoleWorkflowIssueCreateModalDialog';

describe('ConsoleWorkflowIssueCreateModalDialog', () => {
  it('renders with pre-populated title and body', () => {
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix the token validation"
        defaultBody="> Please split the token validation"
        onSubmit={jest.fn().mockResolvedValue(undefined)}
        onClose={jest.fn()}
      />,
    );
    const titleTextarea = getByRole('textbox', { name: 'Title' });
    const bodyTextarea = getByRole('textbox', { name: 'Body' });
    expect((titleTextarea as HTMLTextAreaElement).value).toBe(
      'Fix the token validation',
    );
    expect((bodyTextarea as HTMLTextAreaElement).value).toBe(
      '> Please split the token validation',
    );
  });

  it('calls onSubmit with the current title and body when Create is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix the token validation"
        defaultBody="> Original comment"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        'Fix the token validation',
        '> Original comment',
      );
    });
  });

  it('calls onSubmit with edited title and body', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Original title"
        defaultBody="> Original"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Edited title' },
    });
    fireEvent.change(getByRole('textbox', { name: 'Body' }), {
      target: { value: '> Edited body' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Edited title', '> Edited body');
    });
  });

  it('calls onClose after successful submit', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('disables the submit button immediately on click and keeps it disabled until the API call completes', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );
    const submitBtn = getByRole('button', { name: 'Create' });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });
    await act(async () => {
      resolveSubmit();
    });
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValue(new Error('API error occurred'));
    const { getByRole, getByText } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(getByText('API error occurred')).toBeInTheDocument();
    });
  });

  it('does not close the dialog when onSubmit rejects', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Failed'));
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('re-enables the submit button after a failed submit so the user can retry', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Temporary error'));
    const { getByRole } = render(
      <ConsoleWorkflowIssueCreateModalDialog
        defaultTitle="Fix it"
        defaultBody="> Comment"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );
    const submitBtn = getByRole('button', { name: 'Create' });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });
});
