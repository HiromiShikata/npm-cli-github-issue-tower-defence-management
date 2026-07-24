import { fireEvent, render } from '@testing-library/react';
import type { ConsoleTabName } from '../../logic/types';
import { ConsoleTabList } from './ConsoleTabList';

const counts: Record<ConsoleTabName, number> = {
  'workflow-blocker': 4,
  prs: 3,
  triage: 0,
  unread: 5,
  'failed-preparation': 0,
  'todo-by-human': 2,
  'todo-by-agent': 3,
};

const baseProps = {
  pjcode: 'umino',
  generatedAt: '2026-06-19T08:42:11.000Z',
  tabHref: (tab: ConsoleTabName) => `/projects/umino/${tab}`,
  onSelectTab: () => {},
};

describe('ConsoleTabList', () => {
  it('hides zero-count tabs while showing non-zero tabs', () => {
    const { queryByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(queryByText('Awaiting Quality Check')).not.toBeNull();
    expect(queryByText('Unread')).not.toBeNull();
    expect(queryByText('Todo by human')).not.toBeNull();
    expect(queryByText('Todo by agent')).not.toBeNull();
    expect(queryByText('Triage')).toBeNull();
    expect(queryByText('Failed Preparation')).toBeNull();
  });

  it('keeps the active tab visible even when its count is zero', () => {
    const { getByText, queryByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="failed-preparation"
        counts={counts}
      />,
    );
    const activeBadge = getByText('Failed Preparation')
      .closest('a')
      ?.querySelector('.console-tab-badge');
    expect(activeBadge).toHaveAttribute('data-zero', 'true');
    expect(activeBadge?.textContent).toBe('0');
    expect(getByText('Failed Preparation').closest('a')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(queryByText('Triage')).toBeNull();
  });

  it('marks the active tab as the current page', () => {
    const { getByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(getByText('Awaiting Quality Check').closest('a')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not render an item-count sub-heading', () => {
    const { container } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(container.querySelector('.console-tab-count-heading')).toBeNull();
  });

  it('renders the Workflow Blocker tab immediately left of Awaiting Quality Check', () => {
    const { getByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    const tabBar = getByText('Workflow Blocker').closest('nav');
    const labels = Array.from(
      tabBar?.querySelectorAll('.console-tab-label') ?? [],
    ).map((node) => node.textContent);
    const blockerIndex = labels.indexOf('Workflow Blocker');
    const prsIndex = labels.indexOf('Awaiting Quality Check');
    expect(blockerIndex).toBeGreaterThanOrEqual(0);
    expect(prsIndex).toBe(blockerIndex + 1);
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
