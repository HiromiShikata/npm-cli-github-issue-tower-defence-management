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
    openItemCount: 12,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE',
    openItemCount: 0,
    storyViewUrl: null,
    items: [],
  },
];

const grayStoryEntry: ConsoleStoryEntry = {
  storyName: 'Archived Story',
  storyOptionId: 'gray-id',
  color: 'GRAY',
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
  optimisticColors: {} as Record<string, ConsoleColor>,
  colorChangeInFlight: null as string | null,
  colorErrors: {} as Record<string, string>,
};

describe('ConsoleStoryList', () => {
  const writeText = jest.fn(async () => {});

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders each story name and its open item count', () => {
    const { getByText } = render(<ConsoleStoryList {...defaultProps} />);
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('12')).toBeInTheDocument();
    expect(getByText('Move to Okinawa')).toBeInTheDocument();
    expect(getByText('0')).toBeInTheDocument();
  });

  it('renders an Add task button for each story row', () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const buttons = getAllByRole('button', { name: 'Add task' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('shows the create form when Add task is clicked', () => {
    const { getAllByRole, getByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstButton] = getAllByRole('button', { name: 'Add task' });
    fireEvent.click(firstButton);
    expect(getByPlaceholderText('Issue title')).toBeInTheDocument();
  });

  it('hides the form when Add task is clicked again on the same row', () => {
    const { getAllByRole, queryByPlaceholderText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstButton] = getAllByRole('button', { name: 'Add task' });
    fireEvent.click(firstButton);
    fireEvent.click(firstButton);
    expect(queryByPlaceholderText('Issue title')).toBeNull();
  });

  it('calls onCreateIssue with the correct storyOptionId and title', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByPlaceholderText, getByRole } = render(
      <ConsoleStoryList {...defaultProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getAllByRole('button', { name: 'Add task' })[0]);
    fireEvent.change(getByPlaceholderText('Issue title'), {
      target: { value: 'New feature task' },
    });
    fireEvent.click(getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(onCreateIssue).toHaveBeenCalledWith(
        '1491051e',
        'New feature task',
      ),
    );
  });

  it('shows a validation error when Create is clicked with an empty title', () => {
    const { getAllByRole, getByRole, getByText } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    fireEvent.click(getAllByRole('button', { name: 'Add task' })[0]);
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
    fireEvent.click(getAllByRole('button', { name: 'Add task' })[0]);
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
    fireEvent.click(getAllByRole('button', { name: 'Add task' })[0]);
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

  it('renders a Change color button for each story row', () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const buttons = getAllByRole('button', { name: 'Change color' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('shows the color palette when Change color is clicked', () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const [firstColorButton] = getAllByRole('button', { name: 'Change color' });
    fireEvent.click(firstColorButton);
    expect(getAllByRole('button', { name: /GRAY \(disable\)/ })).toHaveLength(
      1,
    );
  });

  it('hides the palette when Change color is clicked again on the same row', () => {
    const { getAllByRole, queryByRole } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstColorButton] = getAllByRole('button', { name: 'Change color' });
    fireEvent.click(firstColorButton);
    fireEvent.click(firstColorButton);
    expect(queryByRole('button', { name: /GRAY \(disable\)/ })).toBeNull();
  });

  it('calls onSelectColor with the correct storyOptionId and color when a swatch is clicked', () => {
    const onSelectColor = jest.fn();
    const { getAllByRole } = render(
      <ConsoleStoryList {...defaultProps} onSelectColor={onSelectColor} />,
    );
    const [firstColorButton] = getAllByRole('button', { name: 'Change color' });
    fireEvent.click(firstColorButton);
    const greenSwatch = getAllByRole('button', { name: 'GREEN' })[0];
    fireEvent.click(greenSwatch);
    expect(onSelectColor).toHaveBeenCalledWith('1491051e', 'GREEN');
  });

  it('closes the palette after a swatch is clicked', () => {
    const { getAllByRole, queryByRole } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstColorButton] = getAllByRole('button', { name: 'Change color' });
    fireEvent.click(firstColorButton);
    const greenSwatch = getAllByRole('button', { name: 'GREEN' })[0];
    fireEvent.click(greenSwatch);
    expect(queryByRole('button', { name: /GRAY \(disable\)/ })).toBeNull();
  });

  it('GRAY swatch carries an accessible disable label', () => {
    const { getAllByRole, getByRole } = render(
      <ConsoleStoryList {...defaultProps} />,
    );
    const [firstColorButton] = getAllByRole('button', { name: 'Change color' });
    fireEvent.click(firstColorButton);
    expect(getByRole('button', { name: 'GRAY (disable)' })).toBeInTheDocument();
  });

  it('disables Change color button when colorChangeInFlight matches that storyOptionId', () => {
    const { getAllByRole } = render(
      <ConsoleStoryList {...defaultProps} colorChangeInFlight="1491051e" />,
    );
    const colorButtons = getAllByRole('button', { name: 'Change color' });
    expect(colorButtons[0]).toBeDisabled();
    expect(colorButtons[1]).not.toBeDisabled();
  });

  it('displays an optimistic color from optimisticColors prop', () => {
    const { getAllByRole } = render(
      <ConsoleStoryList
        {...defaultProps}
        optimisticColors={{ '1491051e': 'RED' }}
      />,
    );
    const colorButtons = getAllByRole('button', { name: 'Change color' });
    expect(colorButtons[0]).toBeInTheDocument();
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

  it('renders a "Copy name" button for each story row', () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const buttons = getAllByRole('button', { name: 'Copy story name' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('writes the first row story name to clipboard when its "Copy name" button is clicked', async () => {
    const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
    const [firstButton] = getAllByRole('button', { name: 'Copy story name' });
    await act(async () => {
      fireEvent.click(firstButton);
    });
    expect(writeText).toHaveBeenCalledWith(storyEntries[0].storyName);
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
    it('renders a Rename story button for each visible story', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const renameButtons = getAllByRole('button', { name: 'Rename story' });
      expect(renameButtons).toHaveLength(storyEntries.length);
    });

    it('shows the rename form when Rename story is clicked', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
      expect(getByPlaceholderText('Story name')).toBeInTheDocument();
    });

    it('hides the rename form when Rename story is clicked again on the same row', () => {
      const { getAllByRole, queryByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
      fireEvent.click(firstRenameButton);
      expect(queryByPlaceholderText('Story name')).toBeNull();
    });

    it('pre-fills the input with the current story name', () => {
      const { getAllByRole, getByPlaceholderText } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
      const input = getByPlaceholderText('Story name') as HTMLInputElement;
      expect(input.value).toBe(storyEntries[0].storyName);
    });

    it('calls onRenameStory with the correct storyOptionId and new name on submit', async () => {
      const onRenameStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, getByPlaceholderText, getByRole } = render(
        <ConsoleStoryList {...defaultProps} onRenameStory={onRenameStory} />,
      );
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
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
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
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
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
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
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
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
      const [firstRenameButton] = getAllByRole('button', {
        name: 'Rename story',
      });
      fireEvent.click(firstRenameButton);
      fireEvent.change(getByPlaceholderText('Story name'), {
        target: { value: 'Bad name' },
      });
      fireEvent.click(getByRole('button', { name: 'Rename' }));
      const alert = await findByRole('alert');
      expect(alert).toHaveTextContent('Rename failed');
    });
  });

  describe('delete story', () => {
    it('renders a Delete story button for each visible story', () => {
      const { getAllByRole } = render(<ConsoleStoryList {...defaultProps} />);
      const deleteButtons = getAllByRole('button', { name: 'Delete story' });
      expect(deleteButtons).toHaveLength(storyEntries.length);
    });

    it('shows a confirmation dialog when Delete story is clicked', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('shows the story name in the confirmation dialog', () => {
      const { getAllByRole, getByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const dialog = getByRole('dialog');
      expect(dialog).toHaveTextContent('TDPM Console port');
    });

    it('closes the confirmation dialog when Cancel is clicked', () => {
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const cancelButton = getAllByRole('button', { name: 'Cancel' })[0];
      fireEvent.click(cancelButton);
      expect(queryByRole('dialog')).toBeNull();
    });

    it('calls onDeleteStory with the correct storyOptionId when Delete is confirmed', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const confirmButton = getAllByRole('button', { name: 'Delete' })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      expect(onDeleteStory).toHaveBeenCalledWith('1491051e');
    });

    it('closes the dialog after a successful delete', async () => {
      const onDeleteStory = jest.fn().mockResolvedValue(undefined);
      const { getAllByRole, queryByRole } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const confirmButton = getAllByRole('button', { name: 'Delete' })[0];
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
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const confirmButton = getAllByRole('button', { name: 'Delete' })[0];
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      const alert = await findByRole('alert');
      expect(alert).toHaveTextContent('Delete failed');
    });

    it('shows Deleting… text on the confirm button while deletion is in progress', async () => {
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      const onDeleteStory = jest.fn().mockReturnValue(deletePromise);
      const { getAllByRole, getByText } = render(
        <ConsoleStoryList {...defaultProps} onDeleteStory={onDeleteStory} />,
      );
      const [firstDeleteButton] = getAllByRole('button', {
        name: 'Delete story',
      });
      fireEvent.click(firstDeleteButton);
      const confirmButton = getAllByRole('button', { name: 'Delete' })[0];
      fireEvent.click(confirmButton);
      await waitFor(() => expect(getByText('Deleting…')).toBeInTheDocument());
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
        openItemCount: 2,
        storyViewUrl: null,
        items: [
          makeItem({
            number: 10,
            title: 'Fix login bug',
            url: 'https://github.com/demo/repo/issues/10',
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
        openItemCount: 0,
        storyViewUrl: null,
        items: [],
      },
    ];

    it('renders a Show tasks button for each story row', () => {
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

    it('changes button label to Hide tasks after clicking Show tasks', () => {
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
});
