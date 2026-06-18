import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsoleTabBar } from './ConsoleTabBar';

const counts = {
  prs: 3,
  triage: 0,
  unread: 7,
  'failed-preparation': 0,
  'todo-by-human': 0,
};

describe('ConsoleTabBar', () => {
  it('hides tabs with a zero count except the active tab', () => {
    render(
      <ConsoleTabBar
        activeTab="prs"
        counts={counts}
        onSelectTab={() => undefined}
      />,
    );
    expect(screen.getByText('Awaiting Quality Check')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(screen.queryByText('Triage')).toBeNull();
    expect(screen.queryByText('Todo By Human')).toBeNull();
  });

  it('keeps a zero-count active tab visible', () => {
    render(
      <ConsoleTabBar
        activeTab="failed-preparation"
        counts={counts}
        onSelectTab={() => undefined}
      />,
    );
    expect(screen.getByText('Failed Preparation')).toBeInTheDocument();
  });

  it('renders the count badge for each visible tab', () => {
    render(
      <ConsoleTabBar
        activeTab="prs"
        counts={counts}
        onSelectTab={() => undefined}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('invokes onSelectTab when a tab is clicked', async () => {
    const onSelectTab = jest.fn();
    render(
      <ConsoleTabBar
        activeTab="prs"
        counts={counts}
        onSelectTab={onSelectTab}
      />,
    );
    await userEvent.click(screen.getByText('Unread'));
    expect(onSelectTab).toHaveBeenCalledWith('unread');
  });
});
