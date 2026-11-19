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
  status: 'Unread',
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
    storyName: 'Alpha',
    storyOptionId: 'alpha',
    color: 'BLUE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [makeItem(1, { status: 'Unread' })],
  },
  {
    storyName: 'Beta',
    storyOptionId: 'beta',
    color: 'GREEN',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [makeItem(2, { status: 'Preparation' })],
  },
  {
    storyName: 'Empty',
    storyOptionId: 'empty',
    color: 'PURPLE',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
];

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
  selectedStatuses: ['Unread'],
  statusOptionNames: ['Unread', 'Preparation', 'Done'],
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

const storyNamesShown = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>('li'))
    .map((row) => row.querySelector('.console-storytag')?.textContent)
    .filter((name): name is string => name !== undefined && name !== null);

const storyRows = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>('li.console-story-list-row'),
  );

const moveButtons = (row: HTMLElement) => ({
  up: within(row).getByRole('button', { name: 'Move up' }),
  down: within(row).getByRole('button', { name: 'Move down' }),
});

const LOCK_TITLE = 'Clear the status filter to reorder stories';

describe('ConsoleStoryList when the status selection is the default', () => {
  it.each([
    {
      name: 'a zero-task story is shown when Hide empty is off',
      hideEmptyStories: false,
      expectedShown: true,
    },
    {
      name: 'a zero-task story is hidden when Hide empty is on',
      hideEmptyStories: true,
      expectedShown: false,
    },
  ])('$name', ({ hideEmptyStories, expectedShown }) => {
    const { container } = render(
      <ConsoleStoryList
        {...baseProps}
        isStatusSelectionDefault
        hideEmptyStories={hideEmptyStories}
      />,
    );
    expect({
      name: 'Empty',
      shown: storyNamesShown(container).includes('Empty'),
    }).toEqual({ name: 'Empty', shown: expectedShown });
  });

  it('the default selection leaves reorder buttons enabled and untitled', () => {
    const { container } = render(
      <ConsoleStoryList {...baseProps} isStatusSelectionDefault />,
    );
    const rows = storyRows(container);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((row, index) => {
      const { up, down } = moveButtons(row);
      expect({
        up: up.hasAttribute('disabled'),
        down: down.hasAttribute('disabled'),
        upTitle: up.getAttribute('title'),
        downTitle: down.getAttribute('title'),
      }).toEqual({
        up: index === 0,
        down: index === rows.length - 1,
        upTitle: null,
        downTitle: null,
      });
    });
  });

  it('an explicit selection still locks reorder buttons', () => {
    const { container } = render(
      <ConsoleStoryList
        {...baseProps}
        isStatusSelectionDefault={false}
        selectedStatuses={['Unread', 'Preparation']}
      />,
    );
    const rows = storyRows(container);
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((row) => {
      const { up, down } = moveButtons(row);
      for (const button of [up, down]) {
        expect({
          disabled: button.hasAttribute('disabled'),
          title: button.getAttribute('title'),
        }).toEqual({ disabled: true, title: LOCK_TITLE });
      }
    });
  });

  it('applies no status filter, so a story whose tasks are not selected stays visible', () => {
    const { container } = render(
      <ConsoleStoryList {...baseProps} isStatusSelectionDefault />,
    );
    expect(storyNamesShown(container)).toEqual(['Alpha', 'Beta', 'Empty']);
  });

  it('still drops the non-selected story when the selection is explicit', () => {
    const { container } = render(
      <ConsoleStoryList
        {...baseProps}
        isStatusSelectionDefault={false}
        hideEmptyStories={false}
      />,
    );
    expect(storyNamesShown(container)).toEqual(['Alpha']);
    const rows = storyRows(container);
    expect(rows).toHaveLength(1);
    for (const row of rows) {
      const { up, down } = moveButtons(row);
      for (const button of [up, down]) {
        expect({
          disabled: button.hasAttribute('disabled'),
          title: button.getAttribute('title'),
        }).toEqual({ disabled: true, title: LOCK_TITLE });
      }
    }
  });

  it('checks the status boxes from selectedStatuses', () => {
    const { getByRole } = render(
      <ConsoleStoryList {...baseProps} isStatusSelectionDefault />,
    );
    expect(getByRole('checkbox', { name: 'Unread' })).toBeChecked();
    expect(getByRole('checkbox', { name: 'Preparation' })).not.toBeChecked();
    expect(getByRole('checkbox', { name: 'Done' })).not.toBeChecked();
  });

  it('renders no Done toggle', () => {
    const { queryByRole } = render(
      <ConsoleStoryList {...baseProps} isStatusSelectionDefault />,
    );
    expect(queryByRole('switch', { name: 'Done' })).toBeNull();
  });

  it('keeps Move up clickable and calls onReorderStory for the default selection', () => {
    const onReorderStory = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole } = render(
      <ConsoleStoryList
        {...baseProps}
        isStatusSelectionDefault
        onReorderStory={onReorderStory}
      />,
    );
    fireEvent.click(getAllByRole('button', { name: 'Move down' })[0]);
    expect(onReorderStory).toHaveBeenCalledWith('alpha', 'down');
  });
});
