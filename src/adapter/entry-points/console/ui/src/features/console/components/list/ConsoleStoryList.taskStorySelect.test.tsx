import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryEntry,
} from '../../logic/types';
import {
  ConsoleStoryList,
  type ConsoleStoryListProps,
} from './ConsoleStoryList';

const makeTaskItem = (
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number: 7101,
  title: 'Alpha task one',
  url: 'https://github.com/demo/repo/issues/7101',
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: 'item-7101',
  itemId: 'item-7101',
  isPr: false,
  story: 'Story Alpha',
  status: 'Todo by human',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-13T08:18:45.000Z',
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

const buildStories = (): ConsoleStoryEntry[] => [
  {
    storyName: 'Story Alpha',
    storyOptionId: 'story-alpha',
    color: 'BLUE',
    description: '',
    openItemCount: 2,
    storyViewUrl: null,
    items: [
      makeTaskItem({
        number: 7101,
        title: 'Alpha task one',
        url: 'https://github.com/demo/repo/issues/7101',
        projectItemId: 'item-7101',
        itemId: 'item-7101',
        story: 'Story Alpha',
      }),
      makeTaskItem({
        number: 7102,
        title: 'Alpha task two',
        url: 'https://github.com/demo/repo/issues/7102',
        projectItemId: 'item-7102',
        itemId: 'item-7102',
        story: 'Story Alpha',
      }),
    ],
  },
  {
    storyName: 'Story Beta',
    storyOptionId: 'story-beta',
    color: 'PURPLE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [
      makeTaskItem({
        number: 7201,
        title: 'Beta task',
        url: 'https://github.com/demo/repo/issues/7201',
        projectItemId: 'item-7201',
        itemId: 'item-7201',
        story: 'Story Beta',
      }),
    ],
  },
  {
    storyName: 'Story Gamma',
    storyOptionId: 'story-gamma',
    color: 'GREEN',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Story Archived',
    storyOptionId: 'story-archived',
    color: 'GRAY',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
];

const buildProps = (
  overrides: Partial<ConsoleStoryListProps> = {},
): ConsoleStoryListProps => ({
  stories: buildStories(),
  isLoading: false,
  error: null,
  showArchived: false,
  showDone: false,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
  onToggleArchived: () => undefined,
  onToggleDone: () => undefined,
  onReorderStory: () => Promise.resolve(),
  onDeleteStory: () => Promise.resolve(),
  onRenameStory: () => Promise.resolve(),
  onUpdateDescription: () => Promise.resolve(),
  onSetTaskStory: () => Promise.resolve(),
  optimisticColors: {},
  colorChangeInFlight: null,
  colorErrors: {},
  onOpenItem: () => undefined,
  ...overrides,
});

const renderStoryList = (overrides: Partial<ConsoleStoryListProps> = {}) =>
  render(<ConsoleStoryList {...buildProps(overrides)} />);

const storyRowNamed = (
  container: HTMLElement,
  storyName: string,
): HTMLElement => {
  const row = Array.from(
    container.querySelectorAll<HTMLElement>('.console-story-list-row'),
  ).find(
    (element) =>
      element.querySelector('.console-storytag')?.textContent === storyName,
  );
  if (row === undefined) {
    throw new Error(`Story row not found: ${storyName}`);
  }
  return row;
};

const expandStory = (container: HTMLElement, storyName: string): void => {
  fireEvent.click(
    within(storyRowNamed(container, storyName)).getByRole('button', {
      name: 'Show tasks',
    }),
  );
};

const taskRowTitled = (container: HTMLElement, title: string): HTMLElement => {
  const row = Array.from(
    container.querySelectorAll<HTMLElement>('.console-story-task-row'),
  ).find(
    (element) =>
      element.querySelector('.console-story-task-title')?.textContent === title,
  );
  if (row === undefined) {
    throw new Error(`Task row not found: ${title}`);
  }
  return row;
};

const storySelectIn = (row: HTMLElement): HTMLElement =>
  within(row).getByRole('combobox', { name: 'Set story' });

const findTaskItemFixture = (title: string): ConsoleListItem => {
  const taskItem = buildStories()
    .flatMap((story) => story.items)
    .find((item) => item.title === title);
  if (taskItem === undefined) {
    throw new Error(`Task fixture not found: ${title}`);
  }
  return taskItem;
};

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolveFn) => {
    resolve = () => resolveFn();
  });
  return { promise, resolve };
};

describe('ConsoleStoryList task story select', () => {
  it('lists every story of the stories prop in order behind a placeholder option', () => {
    const { container } = renderStoryList({ showArchived: true });
    expandStory(container, 'Story Alpha');

    const options = within(
      storySelectIn(taskRowTitled(container, 'Alpha task one')),
    )
      .getAllByRole('option')
      .map((option) => [option.getAttribute('value'), option.textContent]);

    expect(options).toEqual([
      ['', '— story —'],
      ['story-alpha', 'Story Alpha'],
      ['story-beta', 'Story Beta'],
      ['story-gamma', 'Story Gamma'],
      ['story-archived', 'Story Archived'],
    ]);
  });

  it('renders exactly one Set story pulldown in each task row, pre-selected to the story group that contains the task', () => {
    const cases: Array<{
      storyName: string;
      expectedRows: Array<{ taskTitle: string; expectedStoryOptionId: string }>;
    }> = [
      {
        storyName: 'Story Alpha',
        expectedRows: [
          { taskTitle: 'Alpha task one', expectedStoryOptionId: 'story-alpha' },
          { taskTitle: 'Alpha task two', expectedStoryOptionId: 'story-alpha' },
        ],
      },
      {
        storyName: 'Story Beta',
        expectedRows: [
          { taskTitle: 'Beta task', expectedStoryOptionId: 'story-beta' },
        ],
      },
    ];

    for (const testCase of cases) {
      const { container, unmount } = renderStoryList();
      expandStory(container, testCase.storyName);

      expect({
        storyName: testCase.storyName,
        rowCount: container.querySelectorAll('.console-story-task-row').length,
      }).toEqual({
        storyName: testCase.storyName,
        rowCount: testCase.expectedRows.length,
      });

      for (const expectedRow of testCase.expectedRows) {
        const row = taskRowTitled(container, expectedRow.taskTitle);
        expect({
          taskTitle: expectedRow.taskTitle,
          selectCount: row.querySelectorAll(
            'select.console-story-select[aria-label="Set story"]',
          ).length,
        }).toEqual({ taskTitle: expectedRow.taskTitle, selectCount: 1 });
        expect(storySelectIn(row)).toHaveValue(
          expectedRow.expectedStoryOptionId,
        );
      }
      unmount();
    }
  });

  it('calls onSetTaskStory exactly once with the row task item and the chosen option when a different story is selected', () => {
    const cases: Array<{
      name: string;
      fromStoryName: string;
      taskTitle: string;
      targetStoryOptionId: string;
      expectedOption: ConsoleFieldOption;
    }> = [
      {
        name: 'alpha task moved to beta',
        fromStoryName: 'Story Alpha',
        taskTitle: 'Alpha task one',
        targetStoryOptionId: 'story-beta',
        expectedOption: {
          id: 'story-beta',
          name: 'Story Beta',
          color: 'PURPLE',
        },
      },
      {
        name: 'beta task moved to gamma',
        fromStoryName: 'Story Beta',
        taskTitle: 'Beta task',
        targetStoryOptionId: 'story-gamma',
        expectedOption: {
          id: 'story-gamma',
          name: 'Story Gamma',
          color: 'GREEN',
        },
      },
      {
        name: 'alpha task moved to archived story',
        fromStoryName: 'Story Alpha',
        taskTitle: 'Alpha task two',
        targetStoryOptionId: 'story-archived',
        expectedOption: {
          id: 'story-archived',
          name: 'Story Archived',
          color: 'GRAY',
        },
      },
    ];

    for (const testCase of cases) {
      const onSetTaskStory = jest.fn(() => Promise.resolve());
      const { container, unmount } = renderStoryList({
        onSetTaskStory,
        showArchived: true,
      });
      expandStory(container, testCase.fromStoryName);

      fireEvent.change(
        storySelectIn(taskRowTitled(container, testCase.taskTitle)),
        {
          target: { value: testCase.targetStoryOptionId },
        },
      );

      expect({
        name: testCase.name,
        calls: onSetTaskStory.mock.calls.length,
      }).toEqual({ name: testCase.name, calls: 1 });
      expect(onSetTaskStory).toHaveBeenCalledWith(
        findTaskItemFixture(testCase.taskTitle),
        testCase.expectedOption,
      );
      unmount();
    }
  });

  it('does not call onSetTaskStory when the task is changed to the story it already belongs to', () => {
    const onSetTaskStory = jest.fn(() => Promise.resolve());
    const { container } = renderStoryList({ onSetTaskStory });
    expandStory(container, 'Story Alpha');

    fireEvent.change(
      storySelectIn(taskRowTitled(container, 'Alpha task one')),
      {
        target: { value: 'story-alpha' },
      },
    );

    expect(onSetTaskStory).not.toHaveBeenCalled();
  });

  it('does not call onOpenItem for pulldown interactions', () => {
    const interactions: Array<{
      name: string;
      run: (select: HTMLElement) => void;
    }> = [
      { name: 'focus', run: (select) => fireEvent.focus(select) },
      { name: 'mouse down', run: (select) => fireEvent.mouseDown(select) },
      { name: 'click', run: (select) => fireEvent.click(select) },
      {
        name: 'change to another story',
        run: (select) =>
          fireEvent.change(select, { target: { value: 'story-beta' } }),
      },
    ];

    for (const interaction of interactions) {
      const onOpenItem = jest.fn();
      const { container, unmount } = renderStoryList({ onOpenItem });
      expandStory(container, 'Story Alpha');
      interaction.run(
        storySelectIn(taskRowTitled(container, 'Alpha task one')),
      );
      expect({
        interaction: interaction.name,
        openCalls: onOpenItem.mock.calls.length,
      }).toEqual({ interaction: interaction.name, openCalls: 0 });
      unmount();
    }
  });

  it('calls onOpenItem with the task item when its title button is activated and does not call onSetTaskStory', () => {
    const onOpenItem = jest.fn();
    const onSetTaskStory = jest.fn(() => Promise.resolve());
    const { container } = renderStoryList({ onOpenItem, onSetTaskStory });
    expandStory(container, 'Story Alpha');

    fireEvent.click(
      within(taskRowTitled(container, 'Alpha task one')).getByRole('button', {
        name: 'Alpha task one',
      }),
    );

    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith(
      findTaskItemFixture('Alpha task one'),
    );
    expect(onSetTaskStory).not.toHaveBeenCalled();
  });

  it('disables only the pulldown of the row whose promise is pending and re-enables it when the promise resolves', async () => {
    const deferred = createDeferred();
    const onSetTaskStory = jest.fn(() => deferred.promise);
    const { container } = renderStoryList({ onSetTaskStory });
    expandStory(container, 'Story Alpha');

    fireEvent.change(
      storySelectIn(taskRowTitled(container, 'Alpha task one')),
      {
        target: { value: 'story-beta' },
      },
    );

    await waitFor(() =>
      expect(
        storySelectIn(taskRowTitled(container, 'Alpha task one')),
      ).toBeDisabled(),
    );
    expect(
      storySelectIn(taskRowTitled(container, 'Alpha task two')),
    ).toBeEnabled();
    expect(onSetTaskStory).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve();
    });

    await waitFor(() =>
      expect(
        storySelectIn(taskRowTitled(container, 'Alpha task one')),
      ).toBeEnabled(),
    );
  });

  it('shows the rejection message inside the failing row, re-enables its pulldown, reverts it to the original story, and leaves other rows untouched', async () => {
    const cases: Array<{ errorMessage: string }> = [
      { errorMessage: 'Triage failed' },
      { errorMessage: 'Rate limited by GitHub' },
    ];

    for (const testCase of cases) {
      const onSetTaskStory = jest.fn(() =>
        Promise.reject(new Error(testCase.errorMessage)),
      );
      const { container, unmount } = renderStoryList({ onSetTaskStory });
      expandStory(container, 'Story Alpha');

      fireEvent.change(
        storySelectIn(taskRowTitled(container, 'Alpha task one')),
        {
          target: { value: 'story-beta' },
        },
      );

      await waitFor(() =>
        expect(
          within(taskRowTitled(container, 'Alpha task one')).getByRole('alert'),
        ).toHaveTextContent(testCase.errorMessage),
      );

      const failingRow = taskRowTitled(container, 'Alpha task one');
      expect(storySelectIn(failingRow)).toBeEnabled();
      expect(storySelectIn(failingRow)).toHaveValue('story-alpha');

      const otherRow = taskRowTitled(container, 'Alpha task two');
      expect(within(otherRow).queryByRole('alert')).toBeNull();
      expect(storySelectIn(otherRow)).toBeEnabled();
      expect(storySelectIn(otherRow)).toHaveValue('story-alpha');
      unmount();
    }
  });

  it('renders no pulldown for a story group that has zero tasks', () => {
    const { container } = renderStoryList({
      stories: [buildStories()[2]],
    });
    expandStory(container, 'Story Gamma');

    expect(container.querySelectorAll('.console-story-task-row')).toHaveLength(
      0,
    );
    expect(
      container.querySelectorAll('select[aria-label="Set story"]'),
    ).toHaveLength(0);
  });

  it.each([
    {
      name: 'omits the archived story when the Archived switch is off',
      showArchived: false,
      expectedOptionNames: [
        '— story —',
        'Story Alpha',
        'Story Beta',
        'Story Gamma',
      ],
    },
    {
      name: 'lists the archived story when the Archived switch is on',
      showArchived: true,
      expectedOptionNames: [
        '— story —',
        'Story Alpha',
        'Story Beta',
        'Story Gamma',
        'Story Archived',
      ],
    },
  ])(
    '$name',
    ({ showArchived, expectedOptionNames }) => {
      const { container } = renderStoryList({ showArchived });
      expandStory(container, 'Story Alpha');

      const select = storySelectIn(taskRowTitled(container, 'Alpha task one'));
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(expectedOptionNames);
      expect(select).toHaveValue('story-alpha');
    },
  );

  it('preselects the archived story of a task row and lists it as an option while the Archived switch is on', () => {
    const archivedTask = makeTaskItem({
      number: 7301,
      title: 'Archived task',
      url: 'https://github.com/demo/repo/issues/7301',
      projectItemId: 'item-7301',
      itemId: 'item-7301',
      story: 'Story Archived',
    });
    const stories = buildStories().map((story) =>
      story.storyName === 'Story Archived'
        ? { ...story, openItemCount: 1, items: [archivedTask] }
        : story,
    );
    const { container } = renderStoryList({ stories, showArchived: true });
    expandStory(container, 'Story Archived');

    const select = storySelectIn(taskRowTitled(container, 'Archived task'));
    expect(select).toHaveValue('story-archived');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toContain('Story Archived');
  });
});
