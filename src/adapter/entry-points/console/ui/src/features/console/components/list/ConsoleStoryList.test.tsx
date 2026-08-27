import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleColor, ConsoleStoryEntry } from '../../logic/types';
import { ConsoleStoryList } from './ConsoleStoryList';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    color: 'BLUE',
    openItemCount: 12,
    storyViewUrl: null,
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE',
    openItemCount: 0,
    storyViewUrl: null,
  },
];

const defaultProps = {
  stories: storyEntries,
  isLoading: false,
  error: null,
  onCreateIssue: () => Promise.resolve(),
  onAddStory: () => Promise.resolve(),
  onSelectColor: () => undefined,
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
    const { getAllByRole } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        {...defaultProps}
      />,
    );
    const buttons = getAllByRole('button', { name: 'Copy story name' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('writes the first row story name to clipboard when its "Copy name" button is clicked', async () => {
    const { getAllByRole } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        {...defaultProps}
      />,
    );
    const [firstButton] = getAllByRole('button', { name: 'Copy story name' });
    await act(async () => {
      fireEvent.click(firstButton);
    });
    expect(writeText).toHaveBeenCalledWith(storyEntries[0].storyName);
  });
});
