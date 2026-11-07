import { fireEvent, render, within } from '@testing-library/react';
import type { ConsoleListItem, ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleStoryList,
  type ConsoleStoryListProps,
} from './ConsoleStoryList';

const makeItem = (
  number: number,
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number,
  title: `Task ${number}`,
  url: `https://github.com/demo/repo/issues/${number}`,
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: `item-${number}`,
  itemId: `item-${number}`,
  isPr: false,
  story: 'Story',
  status: 'Preparation',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-13T08:18:45.000Z',
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

const stories: ConsoleStoryEntry[] = [
  {
    storyName: 'Console port',
    storyOptionId: 'console-port',
    color: 'BLUE',
    description: '',
    openItemCount: 2,
    storyViewUrl: null,
    items: [
      makeItem(1, { title: 'Write status filter tests' }),
      makeItem(2, {
        title: 'Confirm Reactivation Trigger display',
        nextActionDate: '2026-11-10',
      }),
      makeItem(3, { title: 'Archive old board fields', status: 'Done' }),
    ],
  },
  {
    storyName: 'Invoice automation',
    storyOptionId: 'invoice-automation',
    color: 'PURPLE',
    description: '',
    openItemCount: 2,
    storyViewUrl: null,
    items: [
      makeItem(4, {
        title: 'Collect invoice template feedback',
        status: 'Awaiting Owner',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/40'],
      }),
      makeItem(5, { title: 'Draft invoice export spec' }),
    ],
  },
  {
    storyName: 'Empty planning story',
    storyOptionId: 'empty-planning',
    color: 'GRAY',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Waiting on vendor',
    storyOptionId: 'waiting-on-vendor',
    color: 'GREEN',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [makeItem(6, { title: 'Wait for vendor reply', nextActionHour: 9 })],
  },
];

const statusOptionNames = ['Awaiting Owner', 'Preparation', 'Done'];

const baseProps: ConsoleStoryListProps = {
  stories,
  isLoading: false,
  error: null,
  showArchived: false,
  showDone: false,
  hideTriggered: false,
  hideEmptyStories: false,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
  onToggleArchived: () => undefined,
  onToggleDone: () => undefined,
  onToggleHideTriggered: () => undefined,
  onToggleHideEmptyStories: () => undefined,
  onReorderStory: () => Promise.resolve(),
  onDeleteStory: () => Promise.resolve(),
  onRenameStory: () => Promise.resolve(),
  onUpdateDescription: () => Promise.resolve(),
  optimisticColors: {},
  colorChangeInFlight: null,
  colorErrors: {},
  onOpenItem: () => undefined,
  statusOptionNames,
  onToggleStatus: () => undefined,
  onClearStatuses: () => undefined,
  agentOptions: [],
  statusFieldOptions: [],
  hiddenRowFields: [],
  onToggleRowField: () => undefined,
  taskActions: {
    onSetStory: () => Promise.resolve(),
    onSetAgent: () => Promise.resolve(),
    onSetStatus: () => Promise.resolve(),
    onSetDependedIssueUrl: () => Promise.resolve(),
    onSetNextActionDate: () => Promise.resolve(),
    onSetNextActionHour: () => Promise.resolve(),
  },
};

const storyRow = (
  container: HTMLElement,
  storyName: string,
): HTMLElement | undefined =>
  Array.from(container.querySelectorAll<HTMLElement>('li')).find(
    (row) => row.querySelector('.console-storytag')?.textContent === storyName,
  );

const badgeText = (
  container: HTMLElement,
  storyName: string,
): string | null | undefined =>
  storyRow(container, storyName)?.querySelector('.console-story-count')
    ?.textContent;

const renderWithExpanded = (
  props: Partial<ConsoleStoryListProps>,
  expandedStoryName: string,
) => {
  const rendered = render(<ConsoleStoryList {...baseProps} {...props} />);
  const row = storyRow(rendered.container, expandedStoryName);
  if (row === undefined) {
    throw new Error(`story row not found: ${expandedStoryName}`);
  }
  fireEvent.click(within(row).getByRole('button', { name: 'Show tasks' }));
  return rendered;
};

describe('ConsoleStoryList hide toggles', () => {
  it('renders Hide triggered and Hide empty after Archived and Done, both off by default', () => {
    const { getAllByRole, getByRole } = render(
      <ConsoleStoryList {...baseProps} />,
    );
    const labels = getAllByRole('switch').map((toggle) =>
      toggle.getAttribute('aria-label'),
    );
    expect(labels.indexOf('Archived')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Archived')).toBeLessThan(labels.indexOf('Done'));
    expect(labels.indexOf('Done')).toBeLessThan(
      labels.indexOf('Hide triggered'),
    );
    expect(labels.indexOf('Hide triggered')).toBeLessThan(
      labels.indexOf('Hide empty'),
    );
    expect(getByRole('switch', { name: 'Hide triggered' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(getByRole('switch', { name: 'Hide empty' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('reflects hideTriggered and hideEmptyStories as checked', () => {
    const { getByRole } = render(
      <ConsoleStoryList
        {...baseProps}
        hideTriggered={true}
        hideEmptyStories={true}
      />,
    );
    expect(getByRole('switch', { name: 'Hide triggered' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(getByRole('switch', { name: 'Hide empty' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onToggleHideTriggered when the Hide triggered switch is clicked', () => {
    const onToggleHideTriggered = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryList
        {...baseProps}
        onToggleHideTriggered={onToggleHideTriggered}
      />,
    );
    fireEvent.click(getByRole('switch', { name: 'Hide triggered' }));
    expect(onToggleHideTriggered).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleHideEmptyStories when the Hide empty switch is clicked', () => {
    const onToggleHideEmptyStories = jest.fn();
    const { getByRole } = render(
      <ConsoleStoryList
        {...baseProps}
        onToggleHideEmptyStories={onToggleHideEmptyStories}
      />,
    );
    fireEvent.click(getByRole('switch', { name: 'Hide empty' }));
    expect(onToggleHideEmptyStories).toHaveBeenCalledTimes(1);
  });

  it('keeps today behaviour when both toggles are off: the badge shows openItemCount and triggered tasks stay visible', () => {
    const rendered = renderWithExpanded({}, 'Console port');
    expect(badgeText(rendered.container, 'Console port')).toBe('2');
    expect(rendered.queryByText('Confirm Reactivation Trigger display')).toBeInTheDocument();
    expect(rendered.queryByText('Write status filter tests')).toBeInTheDocument();
  });

  it('hides triggered tasks from expanded rows and drops them from the badge when Hide triggered is on', () => {
    const rendered = renderWithExpanded(
      { hideTriggered: true },
      'Console port',
    );
    expect(badgeText(rendered.container, 'Console port')).toBe('1');
    expect(
      rendered.queryByText('Confirm Reactivation Trigger display'),
    ).toBeNull();
    expect(rendered.getByText('Write status filter tests')).toBeInTheDocument();
  });

  it('keeps done tasks out of the badge when Hide triggered is on and showDone is on, but shows them in the expanded rows', () => {
    const rendered = renderWithExpanded(
      { hideTriggered: true, showDone: true },
      'Console port',
    );
    expect(badgeText(rendered.container, 'Console port')).toBe('1');
    expect(rendered.getByText('Archive old board fields')).toBeInTheDocument();
    expect(
      rendered.queryByText('Confirm Reactivation Trigger display'),
    ).toBeNull();
  });

  it('hides a story whose badge is 0 when Hide empty is on', () => {
    const rendered = render(
      <ConsoleStoryList {...baseProps} hideEmptyStories={true} />,
    );
    expect(storyRow(rendered.container, 'Empty planning story')).toBeUndefined();
    expect(storyRow(rendered.container, 'Console port')).toBeDefined();
  });

  it('keeps a story whose badge is 0 when Hide empty is off, showing today count', () => {
    const rendered = render(<ConsoleStoryList {...baseProps} />);
    expect(badgeText(rendered.container, 'Empty planning story')).toBe('0');
  });

  it('hides a story left with 0 items by Hide triggered when Hide empty is on, and keeps it at 0 when Hide empty is off', () => {
    const hidden = render(
      <ConsoleStoryList
        {...baseProps}
        hideTriggered={true}
        hideEmptyStories={true}
      />,
    );
    expect(storyRow(hidden.container, 'Waiting on vendor')).toBeUndefined();
    hidden.unmount();

    const shown = render(
      <ConsoleStoryList {...baseProps} hideTriggered={true} />,
    );
    expect(badgeText(shown.container, 'Waiting on vendor')).toBe('0');
  });

  it('applies the status filter first: with Preparation selected and Hide triggered on, Console port shows only the untriggered Preparation task', () => {
    const rendered = renderWithExpanded(
      {
        selectedStatuses: ['Preparation'],
        hideTriggered: true,
      },
      'Console port',
    );
    expect(badgeText(rendered.container, 'Console port')).toBe('1');
    expect(rendered.getByText('Write status filter tests')).toBeInTheDocument();
    expect(
      rendered.queryByText('Confirm Reactivation Trigger display'),
    ).toBeNull();
  });

  it('with Preparation selected and Hide triggered off, the badge counts every visible Preparation task', () => {
    const rendered = render(
      <ConsoleStoryList {...baseProps} selectedStatuses={['Preparation']} />,
    );
    expect(badgeText(rendered.container, 'Console port')).toBe('2');
  });

  it('with a status selected that matches only triggered tasks, Hide triggered empties the story and Hide empty removes it', () => {
    const kept = render(
      <ConsoleStoryList
        {...baseProps}
        selectedStatuses={['Awaiting Owner']}
        hideTriggered={true}
      />,
    );
    expect(badgeText(kept.container, 'Invoice automation')).toBe('0');
    kept.unmount();

    const removed = render(
      <ConsoleStoryList
        {...baseProps}
        selectedStatuses={['Awaiting Owner']}
        hideTriggered={true}
        hideEmptyStories={true}
      />,
    );
    expect(storyRow(removed.container, 'Invoice automation')).toBeUndefined();
  });

  it('with Done selected and Hide triggered on, the Done task still counts toward the badge', () => {
    const rendered = render(
      <ConsoleStoryList
        {...baseProps}
        selectedStatuses={['Done']}
        hideTriggered={true}
      />,
    );
    expect(badgeText(rendered.container, 'Console port')).toBe('1');
  });
});
