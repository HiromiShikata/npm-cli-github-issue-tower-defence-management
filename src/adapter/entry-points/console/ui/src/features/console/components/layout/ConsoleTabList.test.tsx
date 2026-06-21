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

const baseProps = {
  pjcode: 'umino',
  generatedAt: '2026-06-19T08:42:11.000Z',
  tabHref: (tab: ConsoleTabName) => `/projects/umino/${tab}`,
  onSelectTab: () => {},
};

describe('ConsoleTabList', () => {
  it('shows every tab including zero-count tabs', () => {
    const { queryByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(queryByText('Awaiting Quality Check')).not.toBeNull();
    expect(queryByText('Triage')).not.toBeNull();
    expect(queryByText('Unread')).not.toBeNull();
    expect(queryByText('Failed Preparation')).not.toBeNull();
    expect(queryByText('Todo by human')).not.toBeNull();
  });

  it('marks the active tab and renders zero badges with the zero attribute', () => {
    const { getByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    const triageBadge = getByText('Triage')
      .closest('a')
      ?.querySelector('.console-tab-badge');
    expect(triageBadge).toHaveAttribute('data-zero', 'true');
    expect(triageBadge?.textContent).toBe('0');
    expect(getByText('Awaiting Quality Check').closest('a')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders the active tab count sub-heading', () => {
    const { getByText } = render(
      <ConsoleTabList {...baseProps} activeTab="triage" counts={counts} />,
    );
    expect(getByText('0 items to triage')).toBeInTheDocument();
  });

  it('renders the project code and snapshot time', () => {
    const { getByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(getByText('umino')).toBeInTheDocument();
    expect(getByText('snapshot: 2026-06-19T08:42:11.000Z')).toBeInTheDocument();
  });

  it('uses the exact lowercase Todo by human label', () => {
    const { getByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="todo-by-human"
        counts={counts}
      />,
    );
    expect(getByText('Todo by human')).toBeInTheDocument();
  });

  it('reports the selected tab', () => {
    const onSelectTab = jest.fn();
    const { getByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="prs"
        counts={counts}
        onSelectTab={onSelectTab}
      />,
    );
    fireEvent.click(getByText('Unread'));
    expect(onSelectTab).toHaveBeenCalledWith('unread');
  });
});
