import { fireEvent, render } from '@testing-library/react';
import type { ConsoleTabName } from '../../logic/types';
import { ConsoleTabList } from './ConsoleTabList';

const counts: Record<ConsoleTabName, number> = {
  'workflow-blocker': 4,
  prs: 3,
  triage: 0,
  'failed-preparation': 0,
  'todo-by-human': 2,
  'todo-by-agent': 3,
  stories: 0,
};

const baseProps = {
  pjcode: 'acme',
  pjcodes: ['acme', 'beta', 'gamma', 'delta', 'epsilon'],
  generatedAt: '2026-06-19T08:42:11.000Z',
  fromCache: false,
  tabHref: (tab: ConsoleTabName) => `/projects/acme/${tab}`,
  onSelectTab: () => {},
  onSelectProject: () => {},
};

describe('ConsoleTabList', () => {
  it('hides zero-count tabs while showing non-zero tabs', () => {
    const { queryByText } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(queryByText('Awaiting Quality Check')).not.toBeNull();
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
    expect(getByText('acme')).toBeInTheDocument();
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
    fireEvent.click(getByText('Todo by human'));
    expect(onSelectTab).toHaveBeenCalledWith('todo-by-human');
  });

  it('prefixes the snapshot info with "(cached)" and sets data-from-cache when data is from cache', () => {
    const { getByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="prs"
        counts={counts}
        fromCache={true}
      />,
    );
    const genInfo = getByText('(cached) snapshot: 2026-06-19T08:42:11.000Z');
    expect(genInfo).toBeInTheDocument();
    expect(genInfo).toHaveAttribute('data-from-cache', 'true');
  });

  it('omits the cache prefix and data-from-cache attribute when data is from the network', () => {
    const { getByText, queryByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="prs"
        counts={counts}
        fromCache={false}
      />,
    );
    expect(getByText('snapshot: 2026-06-19T08:42:11.000Z')).toBeInTheDocument();
    expect(
      queryByText('(cached) snapshot: 2026-06-19T08:42:11.000Z'),
    ).toBeNull();
    expect(document.querySelector('[data-from-cache]')).toBeNull();
  });

  it('renders the settingsButton prop at the end of the tab bar when provided', () => {
    const { getByTestId } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="prs"
        counts={counts}
        settingsButton={
          <button type="button" data-testid="settings-btn">
            ⚙
          </button>
        }
      />,
    );
    const btn = getByTestId('settings-btn');
    expect(btn).toBeInTheDocument();
    expect(btn.closest('nav.console-tabbar')).not.toBeNull();
  });

  it('does not render a settings slot when settingsButton is not provided', () => {
    const { container } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(container.querySelector('.console-tab-settings')).toBeNull();
  });

  it('opens the project dropdown when the pjcode button is clicked', () => {
    const { getByRole, baseElement } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    expect(
      baseElement.querySelector('.console-tab-pjname-dropdown'),
    ).toBeNull();
    fireEvent.click(getByRole('button', { name: /acme/i }));
    expect(
      baseElement.querySelector('.console-tab-pjname-dropdown'),
    ).toBeInTheDocument();
  });

  it('lists all pjcodes in the dropdown', () => {
    const { getByRole, baseElement } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    fireEvent.click(getByRole('button', { name: /acme/i }));
    const options = Array.from(
      baseElement.querySelectorAll('.console-tab-pjname-option'),
    );
    expect(options.map((o) => o.textContent)).toEqual([
      'acme',
      'beta',
      'gamma',
      'delta',
      'epsilon',
    ]);
  });

  it('calls onSelectProject with the chosen pjcode when a dropdown option is clicked', () => {
    const onSelectProject = jest.fn();
    const { getByRole, getByText } = render(
      <ConsoleTabList
        {...baseProps}
        activeTab="prs"
        counts={counts}
        onSelectProject={onSelectProject}
      />,
    );
    fireEvent.click(getByRole('button', { name: /acme/i }));
    fireEvent.click(getByText('gamma'));
    expect(onSelectProject).toHaveBeenCalledWith('gamma');
  });

  it('closes the dropdown after a project option is selected', () => {
    const { getByRole, getByText, baseElement } = render(
      <ConsoleTabList {...baseProps} activeTab="prs" counts={counts} />,
    );
    fireEvent.click(getByRole('button', { name: /acme/i }));
    expect(
      baseElement.querySelector('.console-tab-pjname-dropdown'),
    ).toBeInTheDocument();
    fireEvent.click(getByText('gamma'));
    expect(
      baseElement.querySelector('.console-tab-pjname-dropdown'),
    ).toBeNull();
  });
});
