import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleDangerousActions } from './ConsoleDangerousActions';

describe('ConsoleDangerousActions', () => {
  it('renders only the toggle button in the collapsed state', () => {
    const { getByText, queryByText } = render(
      <ConsoleDangerousActions onDeleteAllComments={() => {}} />,
    );
    expect(getByText('⚠')).toBeInTheDocument();
    expect(queryByText('Delete All Comments')).toBeNull();
  });

  it('reveals the Delete All Comments button after the toggle is clicked', () => {
    const { getByText } = render(
      <ConsoleDangerousActions onDeleteAllComments={() => {}} />,
    );
    fireEvent.click(getByText('⚠'));
    expect(getByText('Delete All Comments')).toBeInTheDocument();
  });

  it('collapses back when the toggle is clicked a second time', () => {
    const { getByText, queryByText } = render(
      <ConsoleDangerousActions onDeleteAllComments={() => {}} />,
    );
    fireEvent.click(getByText('⚠'));
    fireEvent.click(getByText('⚠'));
    expect(queryByText('Delete All Comments')).toBeNull();
  });

  it('calls onDeleteAllComments and collapses when Delete All Comments is clicked', () => {
    const onDeleteAllComments = jest.fn();
    const { getByText, queryByText } = render(
      <ConsoleDangerousActions onDeleteAllComments={onDeleteAllComments} />,
    );
    fireEvent.click(getByText('⚠'));
    fireEvent.click(getByText('Delete All Comments'));
    expect(onDeleteAllComments).toHaveBeenCalledTimes(1);
    expect(queryByText('Delete All Comments')).toBeNull();
  });

  describe('Delete Story', () => {
    it('does not show Delete Story button when onDeleteStory is not provided', () => {
      const { getByText, queryByText } = render(
        <ConsoleDangerousActions onDeleteAllComments={() => {}} />,
      );
      fireEvent.click(getByText('⚠'));
      expect(queryByText('Delete Story')).toBeNull();
    });

    it('does not show Delete Story button when onDeleteStory is null', () => {
      const { getByText, queryByText } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={null}
        />,
      );
      fireEvent.click(getByText('⚠'));
      expect(queryByText('Delete Story')).toBeNull();
    });

    it('shows Delete Story button when onDeleteStory is provided and expanded', () => {
      const { getByText } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={async () => {}}
        />,
      );
      fireEvent.click(getByText('⚠'));
      expect(getByText('Delete Story')).toBeInTheDocument();
    });

    it('shows confirm dialog with story name when Delete Story is clicked', () => {
      const { getByText, queryByRole } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={async () => {}}
          storyNameForDeletion="improve tdpm console and dashboard"
        />,
      );
      fireEvent.click(getByText('⚠'));
      fireEvent.click(getByText('Delete Story'));
      expect(queryByRole('dialog')).toBeInTheDocument();
      expect(
        getByText(/improve tdpm console and dashboard/),
      ).toBeInTheDocument();
      expect(getByText('Delete')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('hides confirm dialog when Cancel is clicked', () => {
      const { getByText, queryByRole } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={async () => {}}
          storyNameForDeletion="improve tdpm console and dashboard"
        />,
      );
      fireEvent.click(getByText('⚠'));
      fireEvent.click(getByText('Delete Story'));
      fireEvent.click(getByText('Cancel'));
      expect(queryByRole('dialog')).toBeNull();
    });

    it('calls onDeleteStory when Delete is confirmed', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getByText } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={onDeleteStory}
          storyNameForDeletion="improve tdpm console and dashboard"
        />,
      );
      fireEvent.click(getByText('⚠'));
      fireEvent.click(getByText('Delete Story'));
      await act(async () => {
        fireEvent.click(getByText('Delete'));
      });
      expect(onDeleteStory).toHaveBeenCalledTimes(1);
    });

    it('shows loading state while deleting', async () => {
      let resolveDelete!: () => void;
      const onDeleteStory = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );
      const { getByText } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={onDeleteStory}
          storyNameForDeletion="improve tdpm console and dashboard"
        />,
      );
      fireEvent.click(getByText('⚠'));
      fireEvent.click(getByText('Delete Story'));
      fireEvent.click(getByText('Delete'));
      await waitFor(() => expect(getByText('Deleting…')).toBeInTheDocument());
      await act(async () => {
        resolveDelete();
      });
    });

    it('shows error message when deletion fails', async () => {
      const onDeleteStory = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const { getByText } = render(
        <ConsoleDangerousActions
          onDeleteAllComments={() => {}}
          onDeleteStory={onDeleteStory}
          storyNameForDeletion="improve tdpm console and dashboard"
        />,
      );
      fireEvent.click(getByText('⚠'));
      fireEvent.click(getByText('Delete Story'));
      await act(async () => {
        fireEvent.click(getByText('Delete'));
      });
      expect(getByText('Network error')).toBeInTheDocument();
    });
  });
});
