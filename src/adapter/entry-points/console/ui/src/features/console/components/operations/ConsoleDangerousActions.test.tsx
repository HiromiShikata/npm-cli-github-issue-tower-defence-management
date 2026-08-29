import { fireEvent, render } from '@testing-library/react';
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
});
