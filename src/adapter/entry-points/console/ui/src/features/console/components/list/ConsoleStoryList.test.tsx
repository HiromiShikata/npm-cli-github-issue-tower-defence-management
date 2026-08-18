import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleStoryEntry } from '../../logic/types';
import { ConsoleStoryList } from './ConsoleStoryList';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'TDPM Console port',
    storyOptionId: '1491051e',
    color: 'BLUE',
    openItemCount: 12,
  },
  {
    storyName: 'Move to Okinawa',
    storyOptionId: '564803ee',
    color: 'PURPLE',
    openItemCount: 0,
  },
];

describe('ConsoleStoryList', () => {
  it('renders each story name and its open item count', () => {
    const { getByText } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    expect(getByText('TDPM Console port')).toBeInTheDocument();
    expect(getByText('12')).toBeInTheDocument();
    expect(getByText('Move to Okinawa')).toBeInTheDocument();
    expect(getByText('0')).toBeInTheDocument();
  });

  it('renders an Add task button for each story row', () => {
    const { getAllByRole } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    const buttons = getAllByRole('button', { name: 'Add task' });
    expect(buttons).toHaveLength(storyEntries.length);
  });

  it('shows the create form when Add task is clicked', () => {
    const { getAllByRole, getByPlaceholderText } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    const [firstButton] = getAllByRole('button', { name: 'Add task' });
    fireEvent.click(firstButton);
    expect(getByPlaceholderText('Issue title')).toBeInTheDocument();
  });

  it('hides the form when Add task is clicked again on the same row', () => {
    const { getAllByRole, queryByPlaceholderText } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    const [firstButton] = getAllByRole('button', { name: 'Add task' });
    fireEvent.click(firstButton);
    fireEvent.click(firstButton);
    expect(queryByPlaceholderText('Issue title')).toBeNull();
  });

  it('calls onCreateIssue with the correct storyOptionId and title', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByPlaceholderText, getByRole } = render(
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={onCreateIssue}
      />,
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
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
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
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={onCreateIssue}
      />,
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
      <ConsoleStoryList
        stories={storyEntries}
        isLoading={false}
        error={null}
        onCreateIssue={onCreateIssue}
      />,
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
      <ConsoleStoryList
        stories={[]}
        isLoading={true}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    expect(getByText('Loading stories...')).toBeInTheDocument();
  });

  it('shows an empty message when there are no stories', () => {
    const { getByText } = render(
      <ConsoleStoryList
        stories={[]}
        isLoading={false}
        error={null}
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    expect(getByText('No active stories')).toBeInTheDocument();
  });

  it('shows an error message when error is set', () => {
    const { getByRole, getByText } = render(
      <ConsoleStoryList
        stories={[]}
        isLoading={false}
        error="HTTP 503"
        onCreateIssue={() => Promise.resolve()}
      />,
    );
    expect(getByRole('alert')).toBeInTheDocument();
    expect(getByText(/HTTP 503/)).toBeInTheDocument();
  });
});
