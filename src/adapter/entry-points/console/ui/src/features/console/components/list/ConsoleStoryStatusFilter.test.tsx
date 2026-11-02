import { fireEvent, render } from '@testing-library/react';
import { ConsoleStoryStatusFilter } from './ConsoleStoryStatusFilter';

const statusNames = ['Unread', 'Done', 'In Tmux by agent'];

describe('ConsoleStoryStatusFilter', () => {
  it('renders one checkbox per status name inside a Status group', () => {
    const { getByRole, getAllByRole } = render(
      <ConsoleStoryStatusFilter
        statusNames={statusNames}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        onClearStatuses={() => {}}
      />,
    );
    const group = getByRole('group', { name: 'Status' });
    expect(group).toBeInTheDocument();
    const checkboxes = getAllByRole('checkbox');
    expect(checkboxes.map((box) => box.closest('label')?.textContent)).toEqual(
      statusNames,
    );
  });

  it('shows exactly the selected statuses as checked, and several can be checked at once', () => {
    const { getByRole } = render(
      <ConsoleStoryStatusFilter
        statusNames={statusNames}
        selectedStatuses={['Done', 'Unread']}
        onToggleStatus={() => {}}
        onClearStatuses={() => {}}
      />,
    );
    expect(getByRole('checkbox', { name: 'Done' })).toBeChecked();
    expect(getByRole('checkbox', { name: 'Unread' })).toBeChecked();
    expect(
      getByRole('checkbox', { name: 'In Tmux by agent' }),
    ).not.toBeChecked();
  });

  it('calls onToggleStatus with the status name when its checkbox is clicked', () => {
    const onToggleStatus = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryStatusFilter
        statusNames={statusNames}
        selectedStatuses={['Done']}
        onToggleStatus={onToggleStatus}
        onClearStatuses={() => {}}
      />,
    );
    fireEvent.click(getByRole('checkbox', { name: 'Unread' }));
    expect(onToggleStatus).toHaveBeenCalledWith('Unread');
  });

  it('calls onClearStatuses when Clear is clicked and disables Clear when nothing is selected', () => {
    const onClearStatuses = jest.fn();
    const { getByRole, rerender } = render(
      <ConsoleStoryStatusFilter
        statusNames={statusNames}
        selectedStatuses={[]}
        onToggleStatus={() => {}}
        onClearStatuses={onClearStatuses}
      />,
    );
    expect(getByRole('button', { name: 'Clear' })).toBeDisabled();
    rerender(
      <ConsoleStoryStatusFilter
        statusNames={statusNames}
        selectedStatuses={['Done']}
        onToggleStatus={() => {}}
        onClearStatuses={onClearStatuses}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Clear' }));
    expect(onClearStatuses).toHaveBeenCalledTimes(1);
  });
});
