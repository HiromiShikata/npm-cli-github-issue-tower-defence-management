import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleColor, ConsoleStoryEntry } from '../../logic/types';
import { ConsoleStoryList } from './ConsoleStoryList';

const makeItem = (
  overrides: Partial<ConsoleStoryEntry['items'][0]> = {},
): ConsoleStoryEntry['items'][0] => ({
  number: 1,
  title: 'Sample task',
  url: 'https://github.com/demo/repo/issues/1',
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: 'item-1',
  itemId: 'item-1',
  isPr: false,
  story: 'TDPM Console port',
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

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    color: 'BLUE',
    description: '',
    openItemCount: 12,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE',
    description: '',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
];

const grayStoryEntry: ConsoleStoryEntry = {
  storyName: 'Archived Story',
  storyOptionId: 'gray-id',
  color: 'GRAY',
  description: '',
  openItemCount: 3,
  storyViewUrl: null,
  items: [],
};

const entriesWithGray: ConsoleStoryEntry[] = [...storyEntries, grayStoryEntry];

const defaultProps = {
  stories: storyEntries,
  isLoading: false,
  error: null,
  showGray: false,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
  onToggleGray: () => undefined,
  onReorderStory: () => Promise.resolve(),
  onDeleteStory: () => Promise.resolve(),
  onRenameStory: () => Promise.resolve(),
  onUpdateDescription: () => Promise.resolve(),
  optimisticColors: {} as Record<string, ConsoleColor>,
  colorChangeInFlight: null as string | null,
  colorErrors: {} as Record<string, string>,
};

describe('ConsoleStoryList', () => {
  it('renders each story name and its open item count', () => {
    const { getByText } = render(<ConsoleStoryList {...defaultProps} />);
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('12')).toBeInTheDocument();
    expect(getByText('Move to Okinawa')).toBeInTheDocument();
    expect(getByText('0')).toBeInTheDocument();
  });

  it('renders a + Add task button for each story row', () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const buttons = getAllByRole('button', { name: '+ Add task' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('shows the create form when + Add task is clicked', () => {
    const { getAllByRole, getByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstButton] = getAllByRole('button', { name: '+ Add task' });
    fireEvent.click(firstButton);
    expect(getByPlaceholderText('Issue title')).toBeInTheDocument();
  });

  it('hides the form when + Add task is clicked again on the same row', () => {
    const { getAllByRole, queryByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstButton] = getAllByRole('button', { name: '+ Add task' });
    fireEvent.click(firstButton);
    fireEvent.click(firstButton);
    expect(queryByPlaceholderText('Issue title')).toBeNull();
  });

  it('calls onCreateIssue with the correct storyName and title', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByPlaceholderText, getByRole } = render(
      <ConsoleStoryList {...defaultProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'New feature task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onCreateIssue).toHaveBeenCalledWith(
        'TDPM Console port',
        'New feature task',
      ),
    );
  });

  it('shows a validation error when Create is clicked with an empty title', () => {
    const { getAllByRole, getByRole, getByText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(getByText('Title is required')).toBeInTheDocument();
  });

  it('closes the form and clears the input after a successful create', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const {
      getAllByRole,
      getByPlaceholderText,
      getByRole,
      queryByPlaceholderText,
    } = render(
      <ConsoleStoryList {...defaultProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'My task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(queryByPlaceholderText('Issue title')).toBeNull(),
    );
  });

  it('shows an API error when onCreateIssue rejects', async () => {
    const onCreateIssue = jest
      .fn()
      .mockRejectedValue(new Error('Network error'));
    const { getAllByRole, getByPlaceholderText, getByRole, getByText } = render(
      <ConsoleStoryList {...defaultProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'My task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(getByText('Network error')).toBeInTheDocument());
  });

  it('shows a loading message when isLoading is true', () => {
    const { getByText } = render(
      <ConsoleStoryList {...defaultProps} stories={[]} isLoading={true} />,
    );
    expect(getByText('Loading stories...')).toBeInTheDocument();
  });

  it('shows an empty message when there are no stories', () => {
    const { getByText } = render(
      <ConsoleStoryList {...defaultProps} stories={[]} />,
    );
    expect(getByText('No active stories')).toBeInTheDocument();
  });

  it('shows an error message when error is set', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryList {...defaultProps} stories={[]} error="HTTP 503" />,
    );
    expect(getByRole('alert')).toBeInTheDocument();
    expect(getByText(/HTTP 503/)).toBeInTheDocument();
  });

  it('renders story name as a span when storyViewUrl is absent (old JSON format)', () => {
    const oldFormatEntry = {
      storyName: 'TDPM Console port',
      storyOptionId: '1491051e',
      color: 'BLUE',
      openItemCount: 4,
    } as unknown as ConsoleStoryEntry;
    const { getByText } = render(
      <ConsoleStoryList {...defaultProps} stories={[oldFormatEntry]} />,
    );
    const nameEl = getByText('TDPM Console port');
    expect(nameEl.tagName).toBe('SPAN');
  });

  it('renders story name as a span when storyViewUrl is null', () => {
    const { getByText } = render(<ConsoleStoryList {...defaultProps} />);
    const nameEl = getByText('TDPM Console port');
    expect(nameEl.tagName).toBe('SPAN');
  });

  it('renders story name as an anchor when storyViewUrl is non-null', () => {
    const entriesWithUrl: ConsoleStoryEntry[] = [
      {
        ...storyEntries[0],
        storyViewUrl:
          'https://github.com/orgs/demo/projects/1/views/1?sliceBy%5Bvalue%5D=TDPM%20Console%20port',
      },
    ];
    const { getByText } = render(
      <ConsoleStoryList {...defaultProps} stories={entriesWithUrl} />,
    );
    const nameEl = getByText('TDPM Console port');
    expect(nameEl.tagName).toBe('A');
    expect(nameEl).toHaveAttribute(
      'href',
      'https://github.com/orgs/demo/projects/1/views/1?sliceBy%5Bvalue%5D=TDPM%20Console%20port',
    );
    expect(nameEl).toHaveAttribute('target', '_blank');
    expect(nameEl).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders an Add story button', () => {
    const { getByRole } = render(<ConsoleStoryList {...defaultProps} />);
    expect(getByRole('button', { name: 'Add story' })).toBeInTheDocument();
  });

  it('shows the Add story form when Add story button is clicked', () => {
    const { getByRole, getByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    expect(getByPlaceholderText('Story name')).toBeInTheDocument();
  });

  it('hides the Add story form when Add story button is clicked again', () => {
    const { getByRole, queryByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    expect(queryByPlaceholderText('Story name')).toBeNull();
  });

  it('calls onAddStory with the story name and closes the form on success', async () => {
    const onAddStory = jest.fn().mockResolvedValue(undefined);
    const { getByRole, getByPlaceholderText, queryByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} onAddStory={onAddStory} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'My new story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onAddStory).toHaveBeenCalledWith('My new story'),
    );
    await waitFor(() =>
      expect(queryByPlaceholderText('Story name')).toBeNull(),
    );
  });

  it('shows a validation error when Add story Create is clicked with an empty name', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(getByText('Story name is required')).toBeInTheDocument();
  });

  it('shows an API error when onAddStory rejects', async () => {
    const onAddStory = jest.fn().mockRejectedValue(new Error('API failure'));
    const { getByRole, getByPlaceholderText, getByText } = render(
      <ConsoleStoryList {...defaultProps} onAddStory={onAddStory} />,
    );
    fireEvent.click(getByRole('button', { name: 'Add story' }));
    fireEvent.change(getByPlaceholderText('Story name'), {
      target: { value: 'Bad story' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(getByText('API failure')).toBeInTheDocument());
  });

  it('renders Add story button even when there are no stories', () => {
    const { getByRole } = render(
      <ConsoleStoryList {...defaultProps} stories={[]} />,
    );
    expect(getByRole('button', { name: 'Add story' })).toBeInTheDocument();
  });

  describe('overflow menu', () => {
    it('renders a More options button for each story row', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const buttons = getAllByRole('button', { name: 'More options' });
      expect(buttons).toHaveLength(storyEntries.length);
    });

    it('opens the overflow menu when More options is clicked', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      expect(getAllByRole('menuitem').length).toBeGreaterThan(0);
    });

    it('closes the overflow menu when More options is clicked again', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(firstOverflowBtn);
      expect(queryByRole('menu')).toBeNull();
    });

    it('closes the overflow menu when clicking outside', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.mouseDown(document.body);
      expect(queryByRole('menu')).toBeNull();
    });

    it('shows Change color, Rename, Edit description, and Delete story options in the menu', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      expect(getAllByRole('menuitem', { name: 'Change color' })).toHaveLength(
        1,
      );
      expect(getAllByRole('menuitem', { name: 'Rename' })).toHaveLength(1);
      expect(
        getAllByRole('menuitem', { name: 'Edit description' }),
      ).toHaveLength(1);
      expect(getAllByRole('menuitem', { name: 'Delete story' })).toHaveLength(
        1,
      );
    });

    it('opens the color picker dialog when Change color is clicked in the overflow menu', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      expect(getAllByRole('button', { name: /GRAY \(disable\)/ })).toHaveLength(
        1,
      );
    });

    it('closes the overflow menu after clicking Change color', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      expect(queryByRole('menu')).toBeNull();
    });

    it('disables Change color option when colorChangeInFlight matches that storyOptionId', () => {
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} colorChangeInFlight="1491051e" />,
      );
      const overflowBtns = getAllByRole('button', { name: 'More options' });
      fireEvent.click(overflowBtns[0]);
      const changeColorItem = getAllByRole('menuitem', {
        name: 'Change color',
      })[0];
      expect(changeColorItem).toBeDisabled();
    });

    it('does not disable Change color option for other stories when colorChangeInFlight is set', () => {
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} colorChangeInFlight="1491051e" />,
      );
      const overflowBtns = getAllByRole('button', { name: 'More options' });
      fireEvent.click(overflowBtns[1]);
      const changeColorItem = getAllByRole('menuitem', {
        name: 'Change color',
      })[0];
      expect(changeColorItem).not.toBeDisabled();
    });

    it('opens the rename dialog when Rename is clicked in the overflow menu', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      expect(getByPlaceholderText('Story name')).toBeInTheDocument();
    });

    it('closes the overflow menu after clicking Rename', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      expect(queryByRole('menu')).toBeNull();
    });

    it('opens the description dialog when Edit description is clicked in the overflow menu', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      expect(getByPlaceholderText('Story description')).toBeInTheDocument();
    });

    it('closes the overflow menu after clicking Edit description', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      expect(queryByRole('menu')).toBeNull();
    });

    it('shows a confirmation dialog when Delete story is clicked in the overflow menu', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('closes the overflow menu after clicking Delete story', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      expect(queryByRole('menu')).toBeNull();
    });
  });

  describe('change color', () => {
    it('shows the color palette when Change color is clicked via overflow menu', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      expect(getAllByRole('button', { name: /GRAY \(disable\)/ })).toHaveLength(
        1,
      );
    });

    it('calls onSelectColor with the correct storyOptionId and color when a swatch is clicked', () => {
      const onSelectColor = jest.fn();
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onSelectColor={onSelectColor} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      const greenSwatch = getAllByRole('button', { name: 'GREEN' })[0];
      fireEvent.click(greenSwatch);
      expect(onSelectColor).toHaveBeenCalledWith('1491051e', 'GREEN');
    });

    it('closes the palette after a swatch is clicked', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      const greenSwatch = getAllByRole('button', { name: 'GREEN' })[0];
      fireEvent.click(greenSwatch);
      expect(queryByRole('button', { name: /GRAY \(disable\)/ })).toBeNull();
    });

    it('GRAY swatch carries an accessible disable label', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Change color' })[0]);
      expect(
        getByRole('button', { name: 'GRAY (disable)' }),
      ).toBeInTheDocument();
    });

    it('displays an optimistic color from optimisticColors prop', () => {
      const { getByText } = render(
        <ConsoleStoryList
          {...defaultProps}
          optimisticColors={{ '1491051e': 'RED' }}
        />,
      );
      const storytag =
        getByText('TDPM Console port').closest('.console-storytag');
      expect(storytag).toHaveStyle({
        color: '#f85149',
        borderColor: 'rgba(248,81,73,0.4)',
      });
    });

    it('shows a per-row error message from colorErrors prop', () => {
      const { getByText } = render(
        <ConsoleStoryList
          {...defaultProps}
          colorErrors={{ '1491051e': 'Color update failed' }}
        />,
      );
      expect(getByText('Color update failed')).toBeInTheDocument();
    });
  });

  describe('story description', () => {
    it('shows the description form when Edit description is clicked via overflow menu', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      expect(getByPlaceholderText('Story description')).toBeInTheDocument();
    });

    it('displays description text when story has a non-empty description', () => {
      const withDescription: ConsoleStoryEntry[] = [
        { ...storyEntries[0], description: 'Track all TDPM console work' },
        storyEntries[1],
      ];
      const { getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={withDescription} />,
      );
      expect(getByText('Track all TDPM console work')).toBeInTheDocument();
    });

    it('calls onUpdateDescription with the correct storyOptionId and new description on submit', async () => {
      const onUpdateDescription = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, getByPlaceholderText, getByRole } = render(
        <ConsoleStoryList
          {...defaultProps}
          onUpdateDescription={onUpdateDescription}
        />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      fireEvent.change(getByPlaceholderText('Story description'), {
        target: { value: 'New description text' },
      });
      fireEvent.click(getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(onUpdateDescription).toHaveBeenCalledWith(
          '1491051e',
          'New description text',
        ),
      );
    });

    it('closes the description form after a successful save', async () => {
      const onUpdateDescription = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, getByPlaceholderText, getByRole, queryByRole } =
        render(
          <ConsoleStoryList
            {...defaultProps}
            onUpdateDescription={onUpdateDescription}
          />,
        );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      fireEvent.change(getByPlaceholderText('Story description'), {
        target: { value: 'Some description' },
      });
      fireEvent.click(getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(queryByRole('textbox')).toBeNull());
    });

    it('allows saving an empty description', async () => {
      const onUpdateDescription = jest.fn().mockResolvedValue(undefined);
      const withDescription: ConsoleStoryEntry[] = [
        { ...storyEntries[0], description: 'Existing description' },
        storyEntries[1],
      ];
      const { getAllByRole, getByPlaceholderText, getByRole } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={withDescription}
          onUpdateDescription={onUpdateDescription}
        />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(
        getAllByRole('menuitem', { name: 'Edit description' })[0],
      );
      fireEvent.change(getByPlaceholderText('Story description'), {
        target: { value: '' },
      });
      fireEvent.click(getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(onUpdateDescription).toHaveBeenCalledWith('1491051e', ''),
      );
    });
  });

  describe('gray story toggle', () => {
    it('hides gray stories when showGray is false', () => {
      const { queryByText } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={entriesWithGray}
          showGray={false}
        />,
      );
      expect(queryByText('Archived Story')).toBeNull();
      expect(queryByText('TDPM Console port')).toBeInTheDocument();
    });

    it('shows gray stories when showGray is true', () => {
      const { getByText } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={entriesWithGray}
          showGray={true}
        />,
      );
      expect(getByText('Archived Story')).toBeInTheDocument();
    });

    it('shows the toggle button labeled Show archived when at least one gray story exists and showGray is false', () => {
      const { getByRole } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={entriesWithGray}
          showGray={false}
        />,
      );
      expect(
        getByRole('button', { name: 'Show archived' }),
      ).toBeInTheDocument();
    });

    it('shows the toggle button labeled Hide archived when showGray is true', () => {
      const { getByRole } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={entriesWithGray}
          showGray={true}
        />,
      );
      expect(
        getByRole('button', { name: 'Hide archived' }),
      ).toBeInTheDocument();
    });

    it('does not show the toggle button when no gray stories exist', () => {
      const { queryByRole } = render(
        <ConsoleStoryList {...defaultProps} stories={storyEntries} />,
      );
      expect(queryByRole('button', { name: 'Show archived' })).toBeNull();
      expect(queryByRole('button', { name: 'Hide archived' })).toBeNull();
    });

    it('calls onToggleGray when the toggle button is clicked', () => {
      const onToggleGray = jest.fn();
      const { getByRole } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={entriesWithGray}
          showGray={false}
          onToggleGray={onToggleGray}
        />,
      );
      fireEvent.click(getByRole('button', { name: 'Show archived' }));
      expect(onToggleGray).toHaveBeenCalledTimes(1);
    });

    it('shows No active stories when all stories are gray and showGray is false', () => {
      const { getByText } = render(
        <ConsoleStoryList
          {...defaultProps}
          stories={[grayStoryEntry]}
          showGray={false}
        />,
      );
      expect(getByText('No active stories')).toBeInTheDocument();
    });
  });

  describe('reorder buttons', () => {
    it('renders Move up and Move down buttons for each visible story', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const upButtons = getAllByRole('button', { name: 'Move up' });
      const downButtons = getAllByRole('button', { name: 'Move down' });
      expect(upButtons).toHaveLength(storyEntries.length);
      expect(downButtons).toHaveLength(storyEntries.length);
    });

    it('disables the Move up button for the first story', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const upButtons = getAllByRole('button', { name: 'Move up' });
      expect(upButtons[0]).toBeDisabled();
      expect(upButtons[1]).not.toBeDisabled();
    });

    it('disables the Move down button for the last story', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const downButtons = getAllByRole('button', { name: 'Move down' });
      expect(downButtons[0]).not.toBeDisabled();
      expect(downButtons[1]).toBeDisabled();
    });

    it('calls onReorderStory with storyOptionId and up when Move up is clicked', async () => {
      const onReorderStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onReorderStory={onReorderStory} />,
      );
      const upButtons = getAllByRole('button', { name: 'Move up' });
      await act(async () => {
        fireEvent.click(upButtons[1]);
      });
      expect(onReorderStory).toHaveBeenCalledWith('564803ee', 'up');
    });

    it('calls onReorderStory with storyOptionId and down when Move down is clicked', async () => {
      const onReorderStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onReorderStory={onReorderStory} />,
      );
      const downButtons = getAllByRole('button', { name: 'Move down' });
      await act(async () => {
        fireEvent.click(downButtons[0]);
      });
      expect(onReorderStory).toHaveBeenCalledWith('1491051e', 'down');
    });

    it('disables Move up and Move down buttons while reorder is in progress', async () => {
      let resolveReorder: () => void;
      const reorderPromise = new Promise<void>((resolve) => {
        resolveReorder = resolve;
      });
      const onReorderStory = jest.fn().mockReturnValue(reorderPromise);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onReorderStory={onReorderStory} />,
      );
      const downButtons = getAllByRole('button', { name: 'Move down' });
      fireEvent.click(downButtons[0]);
      await waitFor(() => {
        const upButtons = getAllByRole('button', { name: 'Move up' });
        expect(upButtons[0]).toBeDisabled();
        expect(downButtons[0]).toBeDisabled();
      });
      await act(async () => {
        resolveReorder?.();
      });
    });

    it('shows an error message when onReorderStory throws', async () => {
      const onReorderStory = jest
        .fn()
        .mockRejectedValue(new Error('Reorder failed'));
      const { getAllByRole, findByRole } = render(
        <ConsoleStoryList {...defaultProps} onReorderStory={onReorderStory} />,
      );
      const downButtons = getAllByRole('button', { name: 'Move down' });
      await act(async () => {
        fireEvent.click(downButtons[0]);
      });
      const alert = await findByRole('alert');
      expect(alert).toHaveTextContent('Reorder failed');
    });
  });

  describe('rename story', () => {
    it('shows the rename dialog when Rename is clicked via overflow menu', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      expect(getByPlaceholderText('Story name')).toBeInTheDocument();
    });

    it('pre-fills the input with the current story name', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      const input = getByPlaceholderText('Story name') as HTMLInputElement;
      expect(input.value).toBe(storyEntries[0].storyName);
    });

    it('calls onRenameStory with the correct storyOptionId and new name on submit', async () => {
      const onRenameStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, getByPlaceholderText, getByRole } = render(
        <ConsoleStoryList {...defaultProps} onRenameStory={onRenameStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      fireEvent.change(getByPlaceholderText('Story name'), {
        target: { value: 'Renamed story' },
      });
      fireEvent.click(getByRole('button', { name: 'Rename' }));
      await waitFor(() =>
        expect(onRenameStory).toHaveBeenCalledWith('1491051e', 'Renamed story'),
      );
    });

    it('shows a validation error when Rename is clicked with an empty name', () => {
      const { getAllByRole, getByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      fireEvent.change(getByRole('textbox'), { target: { value: '' } });
      fireEvent.click(getByRole('button', { name: 'Rename' }));
      expect(getByText('Story name is required')).toBeInTheDocument();
    });

    it('shows Renaming… text on the button while rename is in progress', async () => {
      let resolveRename: () => void;
      const renamePromise = new Promise<void>((resolve) => {
        resolveRename = resolve;
      });
      const onRenameStory = jest.fn().mockReturnValue(renamePromise);
      const { getAllByRole, getByPlaceholderText, getByText } = render(
        <ConsoleStoryList {...defaultProps} onRenameStory={onRenameStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      fireEvent.change(getByPlaceholderText('Story name'), {
        target: { value: 'New name' },
      });
      fireEvent.click(getAllByRole('button', { name: 'Rename' })[0]);
      await waitFor(() => expect(getByText('Renaming…')).toBeInTheDocument());
      await act(async () => {
        resolveRename?.();
      });
    });

    it('closes the rename form after a successful rename', async () => {
      const onRenameStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, getByPlaceholderText, getByRole, queryByRole } =
        render(
          <ConsoleStoryList {...defaultProps} onRenameStory={onRenameStory} />,
        );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      fireEvent.change(getByPlaceholderText('Story name'), {
        target: { value: 'Renamed story' },
      });
      fireEvent.click(getByRole('button', { name: 'Rename' }));
      await waitFor(() => expect(queryByRole('textbox')).toBeNull());
    });

    it('shows an API error when onRenameStory rejects', async () => {
      const onRenameStory = jest
        .fn()
        .mockRejectedValue(new Error('Rename failed'));
      const { getAllByRole, getByPlaceholderText, getByRole, findByRole } =
        render(
          <ConsoleStoryList {...defaultProps} onRenameStory={onRenameStory} />,
        );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Rename' })[0]);
      fireEvent.change(getByPlaceholderText('Story name'), {
        target: { value: 'Bad name' },
      });
      fireEvent.click(getByRole('button', { name: 'Rename' }));
      const alert = await findByRole('alert');
      expect(alert).toHaveTextContent('Rename failed');
    });
  });

  describe('delete story', () => {
    it('shows a confirmation dialog when Delete story is clicked via overflow menu', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('shows the story name in the confirmation dialog', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const dialog = getByRole('dialog');
      expect(dialog).toHaveTextContent('TDPM Console port');
    });

    it('closes the confirmation dialog when Cancel is clicked', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const cancelButton = getAllByRole('button', { name: 'Cancel' })[0];
      fireEvent.click(cancelButton);
      expect(queryByRole('dialog')).toBeNull();
    });

    it('calls onDeleteStory with storyOptionId and deleteChildTasks true when Delete with child tasks is confirmed', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const confirmButton = getAllByRole('button', {
        name: 'Delete with child tasks',
      })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      expect(onDeleteStory).toHaveBeenCalledWith('1491051e', true);
    });

    it('calls onDeleteStory with storyOptionId and deleteChildTasks false when Keep child tasks is confirmed', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const confirmButton = getAllByRole('button', {
        name: 'Keep child tasks',
      })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      expect(onDeleteStory).toHaveBeenCalledWith('1491051e', false);
    });

    it('closes the dialog after a successful delete', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const confirmButton = getAllByRole('button', {
        name: 'Delete with child tasks',
      })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
    });

    it('shows an error in the dialog when onDeleteStory throws', async () => {
      const onDeleteStory = jest
        .fn()
        .mockRejectedValue(new Error('Delete failed'));
      const { getAllByRole, findByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const confirmButton = getAllByRole('button', {
        name: 'Delete with child tasks',
      })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      const alert = await findByRole('alert');
      expect(alert).toHaveTextContent('Delete failed');
    });

    it('shows Deleting… text on the confirm buttons while deletion is in progress', async () => {
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      const onDeleteStory = jest.fn().mockReturnValue(deletePromise);
      const { getAllByRole, getAllByText } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstOverflowBtn] = getAllByRole('button', {
        name: 'More options',
      });
      fireEvent.click(firstOverflowBtn);
      fireEvent.click(getAllByRole('menuitem', { name: 'Delete story' })[0]);
      const confirmButton = getAllByRole('button', {
        name: 'Delete with child tasks',
      })[0];
      fireEvent.click(confirmButton);
      await waitFor(() => expect(getAllByText('Deleting…')).toHaveLength(2));
      await act(async () => {
        resolveDelete?.();
      });
    });
  });

  describe('story task expansion', () => {
    const storyWithItems: ConsoleStoryEntry[] = [
      {
        storyName: 'TDPM Console port',
        storyOptionId: '1491051e',
        color: 'BLUE',
        description: '',
        openItemCount: 2,
        storyViewUrl: null,
        items: [
          makeItem({
            number: 10,
            title: 'Fix login bug',
            url: 'https://github.com/demo/repo/issues/10',
            status: 'Awaiting Owner',
            agent: 'developer',
            nextActionDate: '2026-07-10T00:00:00.000Z',
            nextActionHour: 9,
            dependedIssueUrls: [
              'https://github.com/demo/repo/issues/5',
              'https://github.com/demo/repo/issues/6',
            ],
          }),
          makeItem({
            number: 11,
            title: 'Add analytics',
            url: 'https://github.com/demo/repo/issues/11',
            status: null,
            agent: null,
            nextActionDate: null,
            nextActionHour: null,
            dependedIssueUrls: [],
          }),
        ],
      },
      {
        storyName: 'Move to Okinawa',
        storyOptionId: '564803ee',
        color: 'PURPLE',
        description: '',
        openItemCount: 0,
        storyViewUrl: null,
        items: [],
      },
    ];

    it('renders a chevron button with aria-label Show tasks for each story row', () => {
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      const buttons = getAllByRole('button', { name: 'Show tasks' });
      expect(buttons).toHaveLength(storyWithItems.length);
    });

    it('does not show task rows before Show tasks is clicked', () => {
      const { queryByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      expect(queryByText('Fix login bug')).toBeNull();
      expect(queryByText('Add analytics')).toBeNull();
    });

    it('shows task titles when Show tasks is clicked', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      const [firstShowButton] = getAllByRole('button', { name: 'Show tasks' });
      fireEvent.click(firstShowButton);
      expect(getByText('Fix login bug')).toBeInTheDocument();
      expect(getByText('Add analytics')).toBeInTheDocument();
    });

    it('renders task title as a link to the issue URL', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      const link = getByRole('link', { name: 'Fix login bug' });
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/demo/repo/issues/10',
      );
    });

    it('shows status value when set', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(getByText('Awaiting Owner')).toBeInTheDocument();
    });

    it('shows agent value when set', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(getByText('developer')).toBeInTheDocument();
    });

    it('shows nextActionDate when set', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(getByText('2026-07-10')).toBeInTheDocument();
    });

    it('shows nextActionHour when set', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(getByText('9')).toBeInTheDocument();
    });

    it('shows dependedIssueUrls comma-separated when set', () => {
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(
        getByText(
          'https://github.com/demo/repo/issues/5, https://github.com/demo/repo/issues/6',
        ),
      ).toBeInTheDocument();
    });

    it('changes chevron aria-label to Hide tasks after clicking Show tasks', () => {
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      const [firstShowButton] = getAllByRole('button', { name: 'Show tasks' });
      fireEvent.click(firstShowButton);
      expect(
        getAllByRole('button', { name: 'Hide tasks' })[0],
      ).toBeInTheDocument();
    });

    it('hides tasks when Hide tasks is clicked', () => {
      const { getAllByRole, queryByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      fireEvent.click(getAllByRole('button', { name: 'Hide tasks' })[0]);
      expect(queryByText('Fix login bug')).toBeNull();
    });

    it('only expands the clicked story row not others', () => {
      const { getAllByRole, getByText, queryByText } = render(
        <ConsoleStoryList {...defaultProps} stories={storyWithItems} />,
      );
      fireEvent.click(getAllByRole('button', { name: 'Show tasks' })[0]);
      expect(getByText('TDPM Console port')).toBeInTheDocument();
      expect(queryByText('Move to Okinawa tasks')).toBeNull();
    });
  });

  describe('onStoryTaskCreateEdit', () => {
    it('calls onStoryTaskCreateEdit with storyName and title when Edit is clicked after a failed Create', async () => {
      const onStoryTaskCreateEdit = jest.fn();
      const onCreateIssue = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const { getAllByRole, getByPlaceholderText, getByRole, findByRole } =
        render(
          <ConsoleStoryList
            {...defaultProps}
            onCreateIssue={onCreateIssue}
            onStoryTaskCreateEdit={onStoryTaskCreateEdit}
          />,
        );
      fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
      fireEvent.change(getByPlaceholderText('Issue title'), {
        target: { value: 'My new task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await findByRole('alert');
      fireEvent.click(getByRole('button', { name: 'Edit' }));
      expect(onStoryTaskCreateEdit).toHaveBeenCalledWith(
        'TDPM Console port',
        'My new task',
      );
    });

    it('closes the create dialog after Edit is clicked', async () => {
      const onStoryTaskCreateEdit = jest.fn();
      const onCreateIssue = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      const {
        getAllByRole,
        getByPlaceholderText,
        getByRole,
        findByRole,
        queryByPlaceholderText,
      } = render(
        <ConsoleStoryList
          {...defaultProps}
          onCreateIssue={onCreateIssue}
          onStoryTaskCreateEdit={onStoryTaskCreateEdit}
        />,
      );
      fireEvent.click(getAllByRole('button', { name: '+ Add task' })[0]);
      fireEvent.change(getByPlaceholderText('Issue title'), {
        target: { value: 'My new task' },
      });
      fireEvent.click(getByRole('button', { name: 'Create' }));
      await findByRole('alert');
      fireEvent.click(getByRole('button', { name: 'Edit' }));
      expect(queryByPlaceholderText('Issue title')).toBeNull();
    });
  });
});
