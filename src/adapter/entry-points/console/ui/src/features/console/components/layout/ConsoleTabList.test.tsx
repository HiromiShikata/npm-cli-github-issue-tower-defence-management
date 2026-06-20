import { fireEvent, render } from '@testing-library/react';
import type { ConsoleTabName } from '../../logic/types';
import { ConsoleTabList } from './ConsoleTabList';

const counts: Record<ConsoleTabName, number> = {
  prs: 3,
  triage: 0,
  unread: 5,
  'failed-preparation': 0,
  'todo-by-human': 2,
};

describe('ConsoleTabList', () => {
  it('hides zero-count tabs except the active tab', () => {
    const { queryByText } = render(
      <ConsoleTabList activeTab="prs" counts={counts} onSelectTab={() => {}} />,
    );
    expect(queryByText('Awaiting Quality Check')).not.toBeNull();
    expect(queryByText('Unread')).not.toBeNull();
    expect(queryByText('Todo by human')).not.toBeNull();
    expect(queryByText('Triage')).toBeNull();
    expect(queryByText('Failed Preparation')).toBeNull();
  });

  it('keeps a zero-count active tab visible', () => {
    const { queryByText } = render(
      <ConsoleTabList
        activeTab="triage"
        counts={counts}
        onSelectTab={() => {}}
      />,
    );
    expect(queryByText('Triage')).not.toBeNull();
  });

  it('uses the exact lowercase Todo by human label', () => {
    const { getByText } = render(
      <ConsoleTabList
        activeTab="todo-by-human"
        counts={counts}
        onSelectTab={() => {}}
      />,
    );
    expect(getByText('Todo by human')).toBeInTheDocument();
  });

  it('reports the selected tab', () => {
    const onSelectTab = jest.fn();
    const { getByText } = render(
      <ConsoleTabList
        activeTab="prs"
        counts={counts}
        onSelectTab={onSelectTab}
      />,
    );
    fireEvent.click(getByText('Unread'));
    expect(onSelectTab).toHaveBeenCalledWith('unread');
  });
});
